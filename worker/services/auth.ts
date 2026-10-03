import { z } from "zod";
import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { and, eq, gt, or, sql } from "drizzle-orm";
import { addDays, addHours, subMinutes } from "date-fns";
import { withDatabase } from "../db/index.ts";
import type { DatabaseExecutor } from "../db/index.ts";
import { users, sessions, authTokens, authThrottles, spaces, categories } from "../db/schema.ts";
import {
  registerSchema,
  loginSchema,
  emailSchema,
  tokenSchema,
  resetSchema,
  userSchema,
} from "../../src/lib/contracts.ts";
import type { User } from "../../src/lib/contracts.ts";
import { hashPassword, verifyPassword, randomToken, hashToken } from "./security.ts";
export type Bindings = Omit<Env, "HYPERDRIVE"> & {
  HYPERDRIVE: Pick<Env["HYPERDRIVE"], "connectionString">;
  APP_ORIGIN?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};
export type AppEnv = { Bindings: Bindings; Variables: { user: User } };
const COOKIE = "financial_os_session";
function publicUser(row: typeof users.$inferSelect): User {
  return userSchema.parse({ ...row, verified: row.verifiedAt !== null });
}
export async function currentUser(c: Context<AppEnv>): Promise<User | null> {
  const token = getCookie(c, COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return withDatabase(c.env, async (db) => {
    const [row] = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
    return row ? publicUser(row.user) : null;
  });
}
async function createSession(c: Context<AppEnv>, userId: string) {
  const token = randomToken();
  await withDatabase(c.env, (db) =>
    db
      .insert(sessions)
      .values({ userId, tokenHash: hashToken(token), expiresAt: addDays(new Date(), 7) }),
  );
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}
export async function throttle(
  c: Context<AppEnv>,
  action: string,
  identifier: string,
  limit = 5,
): Promise<boolean> {
  // Persist both identifier and IP limits; hashing keeps addresses out of the table.
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  return withDatabase(c.env, async (db) => {
    for (const [key, maximum] of [
      [`${action}:identifier:${identifier}`, limit],
      [`${action}:ip:${ip}`, limit * 4],
    ] as const) {
      const now = new Date();
      const cutoff = subMinutes(now, 15);
      const [row] = await db
        .insert(authThrottles)
        .values({ key: hashToken(key), count: 1, windowStart: now })
        .onConflictDoUpdate({
          target: authThrottles.key,
          set: {
            count: sql`CASE WHEN ${authThrottles.windowStart} < ${cutoff} THEN 1 ELSE ${authThrottles.count} + 1 END`,
            windowStart: sql`CASE WHEN ${authThrottles.windowStart} < ${cutoff} THEN ${now} ELSE ${authThrottles.windowStart} END`,
          },
        })
        .returning();
      if (!row || row.count > maximum) return false;
    }
    return true;
  });
}
async function issueToken(db: DatabaseExecutor, userId: string, purpose: "verify" | "reset") {
  const token = randomToken();
  // Lock the account so overlapping resend requests cannot leave multiple live links.
  await db.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
  await db
    .delete(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)));
  await db.insert(authTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: addHours(new Date(), purpose === "verify" ? 24 : 1),
  });
  return token;
}
async function sendEmail(
  c: Context<AppEnv>,
  email: string,
  purpose: "verify" | "reset",
  token: string,
): Promise<boolean> {
  if (!c.env.APP_ORIGIN || !c.env.RESEND_API_KEY || !c.env.EMAIL_FROM) return false;
  const path = purpose === "verify" ? "/verify-email" : "/reset-password";
  const link = new URL(path, c.env.APP_ORIGIN);
  link.searchParams.set("token", token);
  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: c.env.EMAIL_FROM,
        to: [email],
        subject:
          purpose === "verify"
            ? "Verify your Financial OS email"
            : "Reset your Financial OS password",
        text: `Open this link to ${purpose === "verify" ? "verify your email" : "reset your password"}:\n${link.href}\n\nThis link expires in ${purpose === "verify" ? "24 hours" : "one hour"}. If you did not request this, ignore this email.`,
      }),
    });
    if (!result.ok) return false;
    const response: unknown = await result.json();
    return z.object({ id: z.string() }).safeParse(response).success;
  } catch {
    return false;
  }
}
export const auth = new Hono<AppEnv>();
auth.get("/session", async (c) => c.json({ user: await currentUser(c) }));
auth.post("/register", async (c) => {
  const input = registerSchema.parse(await c.req.json());
  const email = input.email.trim().toLowerCase();
  const username = input.username.toLowerCase();
  if (!(await throttle(c, "register", email)))
    return c.json({ message: "Too many attempts. Try again in 15 minutes." }, 429);
  const passwordHash = await hashPassword(input.password);
  const created = await withDatabase(c.env, (db) =>
    db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          name: input.name,
          username,
          email,
          passwordHash,
          reportingCurrency: input.reportingCurrency,
          timezone: input.timezone,
        })
        .onConflictDoNothing()
        .returning();
      if (!user) return null;
      await tx.insert(spaces).values({ userId: user.id, name: "Everyday", isDefault: true });
      await tx
        .insert(categories)
        .values([
          ...["Salary", "Other income"].map((name) => ({ userId: user.id, name, kind: "income" })),
          ...["Food", "Housing", "Transport", "Shopping", "Travel", "Bills", "Other expenses"].map(
            (name) => ({ userId: user.id, name, kind: "expense" }),
          ),
        ]);
      return { user, token: await issueToken(tx, user.id, "verify") };
    }),
  );
  if (!created)
    return c.json(
      {
        message:
          "Registration could not be completed. Try another username or use account recovery.",
      },
      409,
    );
  await createSession(c, created.user.id);
  const sent = await sendEmail(c, email, "verify", created.token);
  return c.json(
    {
      message: sent
        ? "Check your email to verify your account."
        : "Account created. Verification email could not be sent. Please retry from the verification screen.",
    },
    201,
  );
});
auth.post("/login", async (c) => {
  const input = loginSchema.parse(await c.req.json());
  const identifier = input.identifier.toLowerCase();
  if (!(await throttle(c, "login", identifier)))
    return c.json({ message: "Too many attempts. Try again in 15 minutes." }, 429);
  const [user] = await withDatabase(c.env, (db) =>
    db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier))),
  );
  // Run the same expensive password operation for absent users.
  const fallback = `scrypt-v1$00000000000000000000000000000000$${"0".repeat(128)}`;
  const valid = await verifyPassword(input.password, user?.passwordHash ?? fallback);
  if (!user || !valid) return c.json({ message: "Invalid username/email or password." }, 401);
  const previous = getCookie(c, COOKIE);
  if (previous)
    await withDatabase(c.env, (db) =>
      db.delete(sessions).where(eq(sessions.tokenHash, hashToken(previous))),
    );
  await createSession(c, user.id);
  return c.json({ message: "Signed in." });
});
auth.post("/logout", async (c) => {
  const token = getCookie(c, COOKIE);
  if (token)
    await withDatabase(c.env, (db) =>
      db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))),
    );
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ message: "Signed out." });
});
auth.post("/resend", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ message: "Please sign in." }, 401);
  if (user.verified) return c.json({ message: "Your email is already verified." });
  if (!(await throttle(c, "resend", user.id, 3)))
    return c.json({ message: "Too many emails requested. Try again in 15 minutes." }, 429);
  const token = await withDatabase(c.env, (db) =>
    db.transaction((tx) => issueToken(tx, user.id, "verify")),
  );
  const sent = await sendEmail(c, user.email, "verify", token);
  return c.json(
    {
      message: sent
        ? "Verification email sent."
        : "Email delivery is unavailable. Please retry later.",
    },
    sent ? 200 : 503,
  );
});
auth.post("/verify", async (c) => {
  const input = tokenSchema.parse(await c.req.json());
  const verified = await withDatabase(c.env, (db) =>
    db.transaction(async (tx) => {
      const [token] = await tx
        .delete(authTokens)
        .where(
          and(
            eq(authTokens.tokenHash, hashToken(input.token)),
            eq(authTokens.purpose, "verify"),
            gt(authTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!token) return false;
      await tx.update(users).set({ verifiedAt: new Date() }).where(eq(users.id, token.userId));
      return true;
    }),
  );
  return c.json(
    {
      message: verified
        ? "Email verified. You can now sign in."
        : "This link is invalid or expired. Request a new verification email.",
    },
    verified ? 200 : 400,
  );
});
auth.post("/forgot-password", async (c) => {
  const { email } = emailSchema.parse(await c.req.json());
  const normalized = email.toLowerCase();
  if (!(await throttle(c, "recovery", normalized, 3)))
    return c.json({ message: "Too many attempts. Try again in 15 minutes." }, 429);
  const [user] = await withDatabase(c.env, (db) =>
    db.select().from(users).where(eq(users.email, normalized)),
  );
  if (user) {
    const token = await withDatabase(c.env, (db) =>
      db.transaction((tx) => issueToken(tx, user.id, "reset")),
    );
    await sendEmail(c, user.email, "reset", token);
  }
  return c.json({
    message:
      "If an account exists, a password reset link has been sent. You can retry later if it does not arrive.",
  });
});
auth.post("/reset-password", async (c) => {
  const input = resetSchema.parse(await c.req.json());
  if (!(await throttle(c, "reset", hashToken(input.token))))
    return c.json({ message: "Too many attempts. Try again later." }, 429);
  const passwordHash = await hashPassword(input.password);
  const changed = await withDatabase(c.env, (db) =>
    db.transaction(async (tx) => {
      const [token] = await tx
        .delete(authTokens)
        .where(
          and(
            eq(authTokens.tokenHash, hashToken(input.token)),
            eq(authTokens.purpose, "reset"),
            gt(authTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!token) return false;
      await tx.update(users).set({ passwordHash }).where(eq(users.id, token.userId));
      await tx.delete(sessions).where(eq(sessions.userId, token.userId));
      await tx
        .delete(authTokens)
        .where(and(eq(authTokens.userId, token.userId), eq(authTokens.purpose, "reset")));
      return true;
    }),
  );
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json(
    {
      message: changed
        ? "Password reset. Sign in with your new password."
        : "This link is invalid or expired.",
    },
    changed ? 200 : 400,
  );
});
