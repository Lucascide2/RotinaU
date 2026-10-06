import { describe, expect, it } from "vitest";
import { buildSlots, generate, withSessionGaps, type Session } from "@/lib/rotina";

const session = (id: string, start: string, end: string, day = 0): Session => ({
  id, day, start, end, subjectId: "math", review: false, status: "pending",
});

describe("Five-minute session intervals", () => {
  it("moves the start and end equally, retaining thirty minutes", () => {
    const result = withSessionGaps([session("a", "09:00", "09:30"), session("b", "09:30", "10:00")]);
    expect(result[1]).toMatchObject({ start: "09:35", end: "10:05" });
    expect(result[0]).toMatchObject({ start: "09:00", end: "09:30" });
  });

  it("accumulates intervals along a consecutive chain", () => {
    const input = [session("a", "09:00", "09:30"), session("b", "09:30", "10:00"), session("c", "10:00", "10:30")];
    const result = withSessionGaps(input);
    expect(result[2]).toMatchObject({ start: "10:10", end: "10:40" });
    expect(withSessionGaps(result)).toEqual(result);
  });

  it("leaves existing breaks and different days unchanged", () => {
    const input = [session("a", "09:00", "09:30"), session("b", "09:40", "10:10"), session("c", "09:00", "09:30", 1)];
    expect(withSessionGaps(input)).toEqual(input);
  });

  it.each([30, 45, 60])("generates five-minute breaks for %i-minute sessions within availability", (duration) => {
    const slots = buildSlots([{ enabled: true, start: "09:00", end: "12:00" }], duration);
    expect(slots[1]?.start).toBe(540 + duration + 5);
    expect(slots[1]?.end).toBe(540 + duration * 2 + 5);
    expect(slots.every((slot) => slot.end <= 720)).toBe(true);
  });

  it("keeps five minutes around preserved sessions when regenerating", () => {
    const result = generate([{ enabled: true, start: "09:00", end: "11:00" }], [{ id: "math", name: "Cálculo", priority: "alta" }], 30, [{ day: 0, start: 575, end: 605 }]);
    expect(result.map(({ start, end }) => ({ start, end }))).toEqual([
      { start: "09:00", end: "09:30" }, { start: "10:10", end: "10:40" },
    ]);
  });
});