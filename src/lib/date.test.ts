import { addDays, differenceInHours, format, isEqual, toDate } from "date-fns";
import { describe, expect, it } from "vite-plus/test";
import { formatDate, formatDateTime, parseDate } from "./date";

describe("date helpers", () => {
  it("preserves calendar dates and formats leap days", () => {
    expect(formatDate("2024-02-29")).toBe("29 Feb 2024");
    expect(formatDate("2026-10-03", "yyyy-MM-dd")).toBe("2026-10-03");
    expect(formatDate(addDays(parseDate("2024-02-29"), 1))).toBe("01 Mar 2024");
  });

  it("formats local date and time consistently", () => {
    expect(formatDateTime("2026-10-03T14:05:00")).toBe("03 Oct 2026 14:05");
  });

  it("honors explicit offsets on timestamps", () => {
    expect(isEqual(parseDate("2026-10-03T08:00:00+08:00"), parseDate("2026-10-03T00:00:00Z"))).toBe(
      true,
    );
    expect(
      differenceInHours(parseDate("2026-10-03T08:00:00Z"), parseDate("2026-10-03T08:00:00+08:00")),
    ).toBe(8);
  });

  it("accepts millisecond timestamps and clones Date inputs", () => {
    expect(isEqual(parseDate(0), parseDate("1970-01-01T00:00:00Z"))).toBe(true);
    const original = parseDate("2026-10-03");
    expect(parseDate(original)).not.toBe(original);
    expect(format(parseDate(original), "yyyy-MM-dd")).toBe("2026-10-03");
  });

  it.each(["", "not-a-date", "03/10/2026", "2026-02-29", "2026-13-01", NaN, Infinity, toDate(NaN)])(
    "rejects invalid or ambiguous input: %s",
    (value) => {
      expect(() => parseDate(value)).toThrow(RangeError);
      expect(() => formatDate(value)).toThrow(RangeError);
    },
  );
});
