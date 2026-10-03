import { z } from "zod";

export const currencies = [
  "MYR",
  "NZD",
  "USD",
  "SGD",
  "AUD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "THB",
  "IDR",
  "CNY",
  "HKD",
] as const;
export const currencySchema = z.enum(currencies);
export type Currency = z.infer<typeof currencySchema>;
export const decimalSchema = z
  .string()
  .regex(/^\d{1,14}(\.\d{1,8})?$/, "Enter a positive decimal amount");
const SCALE = 100_000_000n;
export function decimalUnits(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, "0"));
  return negative ? -result : result;
}
export function decimalString(value: bigint): string {
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${abs / SCALE}.${(abs % SCALE).toString().padStart(8, "0")}`;
}
export function sumMoney(values: string[]): string {
  return decimalString(values.reduce((sum, value) => sum + decimalUnits(value), 0n));
}
export function negateMoney(value: string): string {
  return decimalString(-decimalUnits(value));
}
export function currencyDecimals(currency: Currency): number {
  return currency === "JPY" ? 0 : 2;
}
export function roundedMoney(value: bigint, currency: Currency): string {
  const step = 10n ** BigInt(8 - currencyDecimals(currency));
  const sign = value < 0n ? -1n : 1n;
  return decimalString(sign * (((value * sign + step / 2n) / step) * step));
}
export function convertMoney(amount: string, rate: string, currency: Currency): string {
  const step = 10n ** BigInt(8 - currencyDecimals(currency));
  const denominator = SCALE * step;
  return decimalString(
    ((decimalUnits(amount) * decimalUnits(rate) + denominator / 2n) / denominator) * step,
  );
}
export function validPrecision(amount: string, currency: Currency): boolean {
  return decimalUnits(amount) % 10n ** BigInt(8 - currencyDecimals(currency)) === 0n;
}
export function moneyLabel(value: string, currency: Currency): string {
  const rounded = roundedMoney(decimalUnits(value), currency);
  const [whole = "0", fraction = ""] = rounded.split(".");
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${currencyDecimals(currency) ? `.${fraction.slice(0, 2)}` : ""}`;
}

// Preserve stored precision while removing insignificant trailing zeroes in editors.
export function editableDecimal(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}
