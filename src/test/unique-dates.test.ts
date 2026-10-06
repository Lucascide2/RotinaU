import { describe, expect, it } from "vitest";
import { defaultState, generate, isEarly, isOverdue, prepareWeeks, sessionsForDate, stateForDate } from "@/lib/rotina";

const now = new Date(2026, 9, 6, 17, 43);
function fixture() {
  const state = defaultState();
  state.weekStart = new Date(2026, 9, 5).toISOString();
  state.days = Array.from({ length: 7 }, () => ({ enabled: true, start: "09:00", end: "10:00" }));
  state.sessions = generate(state.days, state.subjects, 30);
  return prepareWeeks(state, now);
}

describe("Independent calendar dates", () => {
  it("does not reuse today's sessions for the previous Tuesday", () => {
    const state = fixture();
    expect(sessionsForDate(state, new Date(2026, 8, 29))).toEqual([]);
    expect(sessionsForDate(state, new Date(2026, 9, 6))).toHaveLength(1);
  });

  it("creates distinct sessions next Tuesday and uses its actual date for early/overdue rules", () => {
    const state = fixture();
    const current = sessionsForDate(state, now)[0];
    const futureDate = new Date(2026, 9, 13);
    const future = sessionsForDate(state, futureDate)[0];
    if (!current || !future) throw new Error("Missing test sessions");
    expect(future.id).not.toBe(current.id);
    const nextState = stateForDate(state, futureDate);
    expect(isOverdue(nextState.weekStart, future, now)).toBe(false);
    future.status = "done"; future.completedAt = now.toISOString();
    expect(isEarly(nextState.weekStart, future)).toBe(true);
    expect(current.status).toBe("pending");
  });

  it("preserves past completion history and next-week anticipation through rollover", () => {
    const state = fixture();
    const current = sessionsForDate(state, now)[0];
    const future = sessionsForDate(state, new Date(2026, 9, 13))[0];
    if (!current || !future) throw new Error("Missing test sessions");
    current.status = "done"; current.completedAt = now.toISOString();
    future.status = "done"; future.completedAt = now.toISOString();
    const rolled = prepareWeeks(state, new Date(2026, 9, 13));
    expect(sessionsForDate(rolled, now)[0]?.id).toBe(current.id);
    expect(sessionsForDate(rolled, now)[0]?.status).toBe("done");
    expect(sessionsForDate(rolled, new Date(2026, 9, 13))[0]?.status).toBe("done");
  });
});