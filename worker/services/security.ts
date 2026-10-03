import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
export const randomToken = () => randomBytes(32).toString("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [version, salt, key] = encoded.split("$");
  if (version !== "scrypt-v1" || !salt || !key || !/^[a-f0-9]{128}$/.test(key)) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(key, "hex"));
}
