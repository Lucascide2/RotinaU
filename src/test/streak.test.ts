import { describe, it, expect } from "vitest";
import { defaultState, mondayOf, streakOf, type Session, type State } from "@/lib/rotina";
const now = new Date(2026, 9, 7, 20); // quarta
const ws = mondayOf(now).toISOString();
const s = (day: number, done?: Date): Session => ({ id: String(day), day, start: "08:00", end: "08:30", subjectId: "x", review: false, status: done ? "done" : "pending", completedAt: done?.toISOString() });
const st = (sessions: Session[]): State => ({ ...defaultState(), weekStart: ws, sessions, weeks: { [ws]: sessions } });
describe("dias seguidos", () => {
  it("incrementa com todos os dias cumpridos", () => {
    expect(streakOf(st([s(0, new Date(2026, 9, 5, 9)), s(1, new Date(2026, 9, 6, 9)), s(2, new Date(2026, 9, 7, 9))]), now)).toBe(3);
  });
  it("zera se ontem não foi cumprido no próprio dia", () => {
    expect(streakOf(st([s(0, new Date(2026, 9, 5, 9)), s(1, new Date(2026, 9, 7, 9)), s(2)]), now)).toBe(0);
  });
});
