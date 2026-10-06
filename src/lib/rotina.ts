export type Priority = "alta" | "media" | "baixa";
export type Day = { enabled: boolean; start: string; end: string };
export type Subject = { id: string; name: string; priority: Priority };
export type Status = "pending" | "done" | "missed";
export type Session = {
  id: string;
  day: number; // 0 = segunda
  start: string;
  end: string;
  subjectId: string;
  review: boolean;
  status: Status;
  completedAt?: string | undefined; // ISO
  rescheduledFrom?: string; // descrição
};
export type State = {
  step: "intro" | "availability" | "subjects" | "routine";
  days: Day[];
  subjects: Subject[];
  duration: number;
  sessions: Session[];
  weekStart: string; // ISO segunda
  dismissed: string[];
};

export const DAY_NAMES = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
export const DAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const PRIORITY_WEIGHT: Record<Priority, number> = { alta: 3, media: 2, baixa: 1 };
export const PRIORITY_LABEL: Record<Priority, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

export const uid = () => Math.random().toString(36).slice(2, 10);
export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
export const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function dateOfDay(weekStart: string, day: number) {
  const d = new Date(weekStart); d.setDate(d.getDate() + day); return d;
}
export function plannedAt(weekStart: string, s: { day: number; start: string }) {
  const d = dateOfDay(weekStart, s.day); d.setMinutes(toMin(s.start)); return d;
}
export function plannedEnd(weekStart: string, s: { day: number; end: string }) {
  const d = dateOfDay(weekStart, s.day); d.setMinutes(toMin(s.end)); return d;
}
export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const fmtDate = (d: Date) => `${DAY_SHORT[(d.getDay() + 6) % 7]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export function isEarly(weekStart: string, s: Session) {
  return s.status === "done" && !!s.completedAt && new Date(s.completedAt) < plannedAt(weekStart, s);
}
export function isOverdue(weekStart: string, s: Session, now = new Date()) {
  return s.status === "missed" || (s.status === "pending" && plannedEnd(weekStart, s) < now);
}

export function defaultState(): State {
  const blank = { enabled: false, start: "18:00", end: "19:00" };
  const days: Day[] = DAY_NAMES.map(() => ({ ...blank }));
  days[0] = { enabled: true, start: "14:00", end: "16:00" };
  days[2] = { enabled: true, start: "18:00", end: "19:00" };
  days[5] = { enabled: true, start: "09:00", end: "11:00" };
  return {
    step: "intro",
    days,
    subjects: [
      { id: uid(), name: "Cálculo", priority: "alta" },
      { id: uid(), name: "Programação", priority: "media" },
      { id: uid(), name: "Redes", priority: "baixa" },
    ],
    duration: 30,
    sessions: [],
    weekStart: mondayOf(new Date()).toISOString(),
    dismissed: [],
  };
}

type Slot = { day: number; start: number; end: number };

export function buildSlots(days: Day[], duration: number): Slot[] {
  const slots: Slot[] = [];
  days.forEach((d, day) => {
    if (!d.enabled) return;
    for (let t = toMin(d.start); t + duration <= toMin(d.end); t += duration) slots.push({ day, start: t, end: t + duration });
  });
  return slots;
}

/** Gera rotina: proporcional à prioridade, com revisões em dias diferentes do estudo inicial. */
export function generate(days: Day[], subjects: Subject[], duration: number, blocked: Slot[] = [], after?: Date, weekStart?: string): Session[] {
  let slots = buildSlots(days, duration).filter(
    (s) => !blocked.some((b) => b.day === s.day && s.start < b.end && b.start < s.end),
  );
  if (after && weekStart) slots = slots.filter((s) => plannedAt(weekStart, { day: s.day, start: toTime(s.start) }) > after);
  if (!subjects.length || !slots.length) return [];
  const reviewCount = slots.length >= 3 ? Math.max(1, Math.round(slots.length * 0.2)) : 0;
  const studySlots = slots.slice(0, slots.length - reviewCount);
  const reviewSlots = slots.slice(slots.length - reviewCount);
  const credit: Record<string, number> = {};
  subjects.forEach((s) => (credit[s.id] = 0));
  const total = subjects.reduce((a, s) => a + PRIORITY_WEIGHT[s.priority], 0);
  const out: Session[] = [];
  let last = "";
  const firstDay: Record<string, number> = {};
  for (const slot of studySlots) {
    subjects.forEach((s) => (credit[s.id]! += PRIORITY_WEIGHT[s.priority] / total));
    const ranked = [...subjects].sort((a, b) => credit[b.id]! - credit[a.id]!);
    const pick = ranked.find((s) => s.id !== last) ?? ranked[0]!;
    credit[pick.id]! -= 1;
    last = pick.id;
    firstDay[pick.id] ??= slot.day;
    out.push({ id: uid(), day: slot.day, start: toTime(slot.start), end: toTime(slot.end), subjectId: pick.id, review: false, status: "pending" });
  }
  const byPriority = [...subjects].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
  reviewSlots.forEach((slot, i) => {
    const candidates = byPriority.filter((s) => firstDay[s.id] !== undefined && firstDay[s.id] !== slot.day);
    const pool = candidates.length ? candidates : byPriority;
    const pick = pool[i % pool.length]!;
    out.push({ id: uid(), day: slot.day, start: toTime(slot.start), end: toTime(slot.end), subjectId: pick.id, review: true, status: "pending" });
  });
  return out;
}

/** Procura horário futuro livre, preferindo o dia menos carregado. */
export function findFreeSlot(state: State, s: Session, now = new Date()) {
  const len = toMin(s.end) - toMin(s.start);
  const slots = buildSlots(state.days, len).filter((sl) => {
    if (plannedAt(state.weekStart, { day: sl.day, start: toTime(sl.start) }) <= now) return false;
    return !state.sessions.some((o) => o.id !== s.id && o.day === sl.day && toMin(o.start) < sl.end && sl.start < toMin(o.end));
  });
  if (!slots.length) return null;
  const load = (d: number) => state.sessions.filter((o) => o.day === d).length;
  slots.sort((a, b) => load(a.day) - load(b.day) || a.day - b.day || a.start - b.start);
  const sl = slots[0]!;
  return { day: sl.day, start: toTime(sl.start), end: toTime(sl.end) };
}

export function stats(state: State, now = new Date()) {
  const done = state.sessions.filter((s) => s.status === "done");
  const early = done.filter((s) => isEarly(state.weekStart, s));
  const missed = state.sessions.filter((s) => isOverdue(state.weekStart, s, now));
  const daySet = new Set(done.map((s) => dayKey(new Date(s.completedAt!))));
  let streak = 0;
  const cur = new Date(now);
  if (!daySet.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
  while (daySet.has(dayKey(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
  return { total: state.sessions.length, done: done.length, early: early.length, missed: missed.length, days: daySet.size, streak };
}
