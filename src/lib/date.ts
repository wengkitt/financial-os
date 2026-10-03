import { tz } from "@date-fns/tz";
import { format, isValid, parseISO, toDate } from "date-fns";

/** Strings must be ISO 8601; numbers are Unix timestamps in milliseconds. */
export type DateInput = Date | string | number;

export const DATE_FORMAT = "dd MMM yyyy";
export const DATE_TIME_FORMAT = "dd MMM yyyy HH:mm";

/** Parses ISO strings without treating a date-only value as UTC midnight. */
export function parseDate(value: DateInput): Date {
  const date = typeof value === "string" ? parseISO(value) : toDate(value);

  if (!isValid(date)) {
    throw new RangeError("Invalid date. Use an ISO 8601 string, Date, or millisecond timestamp.");
  }

  return date;
}

/** Formats in the runtime's local time zone. */
export function formatDate(value: DateInput, pattern = DATE_FORMAT): string {
  return format(parseDate(value), pattern);
}

export function formatDateTime(value: DateInput): string {
  return formatDate(value, DATE_TIME_FORMAT);
}

/** Financial calendar boundaries follow the account timezone, not the Worker timezone. */
export function accountToday(timezone: string, now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd", { in: tz(timezone) });
}
