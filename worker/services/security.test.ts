import { describe, it, expect } from "vite-plus/test";
import { hashPassword, verifyPassword, randomToken, hashToken } from "./security.ts";
describe("Authentication cryptography", () => {
  it("salts password hashes and verifies only the correct password", async () => {
    const password = "a sufficiently long passphrase";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("wrong password", first)).toBe(false);
    expect(await verifyPassword(password, "invalid")).toBe(false);
  });
  it("creates opaque tokens and stable non-reversible storage keys", () => {
    const token = randomToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(randomToken()).not.toBe(token);
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toBe(hashToken(token));
  });
});
