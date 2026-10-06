import { describe, it, expect } from "vitest";
import { canSuggestIncrease, defaultState, mondayOf, replanFromToday, type Session, type State } from "@/lib/rotina";
const now = new Date(2026, 9, 7, 12); // quarta
const cur = mondayOf(now).toISOString();
const prevD = new Date(mondayOf(now)); prevD.setDate(prevD.getDate() - 7); const prev = prevD.toISOString();
const s = (id: string, day: number, done = false): Session => ({ id, day, start: "08:00", end: "08:30", subjectId: "x", review: false, status: done ? "done" : "pending", completedAt: done ? now.toISOString() : undefined });
const base = (weeks: Record<string, Session[]>, extra: Partial<State> = {}): State => ({ ...defaultState(), weekStart: cur, sessions: weeks[cur] ?? [], weeks, ...extra });

describe("sugestão de aumento", () => {
  it("só aparece com a semana anterior toda cumprida", () => {
    expect(canSuggestIncrease(base({ [prev]: [s("a", 0, true), s("b", 1, true)] }), now)).toBe(true);
    expect(canSuggestIncrease(base({ [prev]: [s("a", 0, true), s("b", 1)] }), now)).toBe(false);
  });
  it("não reaparece se mostrada nas últimas duas semanas", () => {
    expect(canSuggestIncrease(base({ [prev]: [s("a", 0, true)] }, { upShownAt: new Date(2026, 8, 30).toISOString() }), now)).toBe(false);
    expect(canSuggestIncrease(base({ [prev]: [s("a", 0, true)] }, { upShownAt: new Date(2026, 8, 20).toISOString() }), now)).toBe(true);
  });
});

describe("ajustar rotina", () => {
  const fresh = [s("n0", 0), s("n2", 2), s("n4", 4)];
  it("mantém dias passados e troca hoje se nada foi estudado", () => {
    const r = replanFromToday(base({ [cur]: [s("o0", 0), s("o2", 2), s("o4", 4)] }), fresh, now);
    expect(r.sessions.map((x) => x.id).sort()).toEqual(["n2", "n4", "o0"]);
  });
  it("mantém hoje se já estudou alguma sessão", () => {
    const r = replanFromToday(base({ [cur]: [s("o0", 0), s("o2", 2, true), s("o4", 4)] }), fresh, now);
    expect(r.sessions.map((x) => x.id).sort()).toEqual(["n4", "o0", "o2"]);
  });
});
