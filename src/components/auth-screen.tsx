import { useEffect } from "react";
import { choices } from "@/lib/form-options";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "@tanstack/react-router";
import { WalletCards, ArrowRight } from "lucide-react";
import { FinanceForm } from "./finance-form";
import type { FormSpec } from "./finance-form";
import {
  registerSchema,
  loginSchema,
  emailSchema,
  resetSchema,
  tokenSchema,
} from "@/lib/contracts";
import { currencies } from "@/lib/money";
import { sessionOptions, useWrite } from "@/queries/financial";
import { timezoneChoices } from "@/lib/form-options";
import { buttonVariants } from "./ui/button-variants";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
export type AuthMode = "login" | "register" | "verify" | "forgot" | "reset";
export function AuthScreen({ mode, token = "" }: { mode: AuthMode; token?: string }) {
  const session = useQuery(sessionOptions);
  const write = useWrite();
  const client = useQueryClient();
  useEffect(() => {
    document.title = `${mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "verify" ? "Email verification" : "Password recovery"} · Financial OS`;
  }, [mode]);
  if ((mode === "login" || mode === "register") && session.data?.user)
    return session.data.user.verified ? (
      <Navigate to="/app/$section" params={{ section: "dashboard" }} />
    ) : (
      <Navigate to="/verify-email" />
    );
  const definitions: Record<AuthMode, { title: string; description: string; spec?: FormSpec }> = {
    login: {
      title: "Welcome back",
      description: "Your finances, in one place.",
      spec: {
        fields: [
          { name: "identifier", label: "Username or email", autocomplete: "username" },
          {
            name: "password",
            label: "Password",
            type: "password",
            autocomplete: "current-password",
          },
        ],
        defaults: { identifier: "", password: "" },
        schema: loginSchema,
        payload: (v) => v,
        path: "/api/auth/login",
        submit: "Sign in",
        pendingLabel: "Signing in…",
      },
    },
    register: {
      title: "Create your account",
      description: "Start making sense of your money.",
      spec: {
        fields: [
          { name: "name", label: "Name", autocomplete: "name" },
          {
            name: "username",
            label: "Username",
            autocomplete: "username",
            help: "3–32 letters, numbers, or underscores.",
          },
          { name: "email", label: "Email", type: "email", autocomplete: "email" },
          {
            name: "password",
            label: "Password",
            type: "password",
            autocomplete: "new-password",
            help: "Use 15–128 characters. A passphrase works well.",
          },
          {
            name: "reportingCurrency",
            label: "Reporting currency",
            options: choices(currencies),
            help: "Used for totals and budgets. It becomes fixed after financial setup.",
          },
          { name: "timezone", label: "Timezone", options: timezoneChoices },
        ],
        defaults: {
          name: "",
          username: "",
          email: "",
          password: "",
          reportingCurrency: "MYR",
          timezone: "Asia/Kuala_Lumpur",
        },
        schema: registerSchema,
        payload: (v) => v,
        path: "/api/auth/register",
        submit: "Create account",
        pendingLabel: "Creating account…",
      },
    },
    forgot: {
      title: "Forgot your password?",
      description: "We’ll email you a link to reset it.",
      spec: {
        fields: [{ name: "email", label: "Email", type: "email", autocomplete: "email" }],
        defaults: { email: "" },
        schema: emailSchema,
        payload: (v) => v,
        path: "/api/auth/forgot-password",
        submit: "Send reset link",
        pendingLabel: "Sending link…",
      },
    },
    reset: {
      title: "Choose a new password",
      description: "Reset links expire after one hour.",
      spec: {
        fields: [
          {
            name: "password",
            label: "New password",
            type: "password",
            autocomplete: "new-password",
            help: "Use 15–128 characters.",
          },
        ],
        defaults: { password: "" },
        schema: resetSchema,
        payload: (v) => ({ ...v, token }),
        path: "/api/auth/reset-password",
        submit: "Reset password",
      },
    },
    verify: {
      title: "Verify your email",
      description: session.data?.user
        ? `Check ${session.data.user.email} for your verification link.`
        : "Confirm your email to access Financial OS.",
      spec: token
        ? {
            fields: [],
            defaults: {},
            schema: tokenSchema,
            payload: () => ({ token }),
            path: "/api/auth/verify",
            submit: "Verify email",
          }
        : undefined,
    },
  };
  const selected = definitions[mode];
  const validToken = tokenSchema.safeParse({ token }).success;
  const invalidLink = (mode === "reset" || (mode === "verify" && Boolean(token))) && !validToken;
  const verified = mode === "verify" && session.data?.user?.verified;
  if (mode === "verify" && session.isPending)
    return (
      <main className="auth-layout">
        <Skeleton className="h-48 w-full max-w-md" />
        <p>Loading your account…</p>
      </main>
    );
  return (
    <main className="auth-layout">
      <div className="auth-brand">
        <WalletCards className="size-5" />
        <span>Financial OS</span>
      </div>
      <Card className="auth-card w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {verified
              ? "Email verified — you’re ready"
              : invalidLink
                ? "This link is invalid"
                : selected.title}
          </CardTitle>
          <CardDescription>
            {verified
              ? "Your account is ready to use."
              : invalidLink
                ? "Request a new link to continue."
                : selected.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {selected.spec && !invalidLink && !verified && (
            <FinanceForm key={`${mode}-${token}`} spec={selected.spec} appearance="auth" />
          )}
          {invalidLink && mode === "reset" && (
            <Link to="/forgot-password" className={buttonVariants({ variant: "outline" })}>
              Request a new reset link
            </Link>
          )}
          {mode === "reset" && !invalidLink && (
            <Link to="/forgot-password">Link expired? Request another</Link>
          )}
          {mode === "verify" && session.data?.user?.verified && (
            <Link className={buttonVariants()} to="/app/$section" params={{ section: "dashboard" }}>
              Open Financial OS
              <ArrowRight data-icon="inline-end" />
            </Link>
          )}
          {mode === "verify" && !session.data?.user?.verified && session.data?.user && (
            <Button
              variant="outline"
              disabled={write.isPending}
              onClick={() => write.mutate({ path: "/api/auth/resend", payload: {} })}
            >
              Resend verification email
            </Button>
          )}
          {mode === "verify" && !token && !session.data?.user && (
            <p className="text-sm text-muted-foreground">
              Sign in to request a new verification email.
            </p>
          )}
          {write.isError && (
            <Alert variant="destructive">
              <AlertDescription>{write.error.message}</AlertDescription>
            </Alert>
          )}
          {write.data && (
            <Alert role="status">
              <AlertDescription>{write.data.message}</AlertDescription>
            </Alert>
          )}
          {session.isError && (
            <Alert variant="destructive">
              <AlertDescription>{session.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-4 text-sm">
          {mode === "login" ? (
            <>
              <Link to="/register">Create an account</Link>
              <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </>
          ) : (
            <Link to="/login">Back to sign in</Link>
          )}
          {mode === "verify" && session.data?.user && (
            <Button
              variant="ghost"
              disabled={write.isPending}
              onClick={async () => {
                await write.mutateAsync({ path: "/api/auth/logout", payload: {} });
                client.clear();
              }}
            >
              Sign out
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
