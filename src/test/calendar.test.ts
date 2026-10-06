import { describe, expect, it } from "vitest";
import { calendarOffsets } from "@/lib/calendar";

describe("Calendar date windows", () => {
  it("includes today and all seven days ahead", () => {
    expect(calendarOffsets(false)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("includes all seven days behind and today", () => {
    expect(calendarOffsets(true)).toEqual([-7, -6, -5, -4, -3, -2, -1, 0]);
  });
});