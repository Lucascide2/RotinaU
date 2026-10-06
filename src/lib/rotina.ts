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
  weeks?: Record<string, Session[]>;
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
/** Índice 0..6 com segunda = 0 (Date.getDay() usa domingo = 0). */
export const weekIndexOf = (d: Date) => (d.getDay() + 6) % 7;
export const fmtDate = (d: Date) => `${DAY_SHORT[weekIndexOf(d)]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
export const fmtDay = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
export const todayIdxOf = (now: Date) => weekIndexOf(now);
/** Data de um dia relativo a hoje (0 = hoje, -1 = ontem, 6 = daqui a 6 dias). */
export function dayOffsetDate(weekStart: string, now: Date, offset: number) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() + offset); return d;
}

export function stateForDate(state: State, date: Date): State {
  const weekStart = mondayOf(date).toISOString();
  return { ...state, weekStart, sessions: weekStart === state.weekStart ? state.sessions : state.weeks?.[weekStart] ?? [] };
}

export function sessionsForDate(state: State, date: Date): Session[] {
  return stateForDate(state, date).sessions.filter((session) => session.day === weekIndexOf(date));
}

/** Migra a semana salva, mantém histórico e prepara semanas futuras independentes. */
export function prepareWeeks(state: State, now: Date): State {
  const weeks = { ...state.weeks, [state.weekStart]: withSessionGaps(state.sessions) };
  const current = mondayOf(now).toISOString();
  const hasPlan = Object.values(weeks).some((sessions) => sessions.length > 0);
  if (!weeks[current]) weeks[current] = hasPlan ? generate(state.days, state.subjects, state.duration) : [];
  const next = new Date(now); next.setDate(next.getDate() + 7);
  const nextWeek = mondayOf(next).toISOString();
  if (hasPlan && !weeks[nextWeek]) weeks[nextWeek] = generate(state.days, state.subjects, state.duration);
  return { ...state, weekStart: current, sessions: weeks[current] ?? [], weeks,
    dismissed: current === state.weekStart ? state.dismissed : [] };
}

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

export const SESSION_GAP = 5;

/** Ajusta sessões já salvas, preservando duração e sem repetir o deslocamento. */
export function withSessionGaps(sessions: Session[]): Session[] {
  const adjusted = new Map<string, Session>();
  const sorted = [...sessions].sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
  let previous: Session | undefined;
  for (const session of sorted) {
    const start = toMin(session.start);
    const shift = previous?.day === session.day
      ? Math.max(0, toMin(previous.end) + SESSION_GAP - start)
      : 0;
    const next = shift > 0
      ? { ...session, start: toTime(start + shift), end: toTime(toMin(session.end) + shift) }
      : session;
    adjusted.set(session.id, next);
    previous = next;
  }
  return sessions.map((session) => adjusted.get(session.id) ?? session);
}

export function buildSlots(days: Day[], duration: number): Slot[] {
  const slots: Slot[] = [];
  days.forEach((d, day) => {
    if (!d.enabled) return;
    for (let t = toMin(d.start); t + duration <= toMin(d.end); t += duration + SESSION_GAP) slots.push({ day, start: t, end: t + duration });
  });
  return slots;
}

/** Gera rotina: proporcional à prioridade, com revisões em dias diferentes do estudo inicial. */
export function generate(days: Day[], subjects: Subject[], duration: number, blocked: Slot[] = [], after?: Date, weekStart?: string): Session[] {
  let slots = buildSlots(days, duration).filter(
    (s) => !blocked.some((b) => b.day === s.day && s.start < b.end + SESSION_GAP && b.start < s.end + SESSION_GAP),
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
    return !state.sessions.some((o) => o.id !== s.id && o.day === sl.day && toMin(o.start) < sl.end + SESSION_GAP && sl.start < toMin(o.end) + SESSION_GAP);
  });
  if (!slots.length) return null;
  const load = (d: number) => state.sessions.filter((o) => o.day === d).length;
  slots.sort((a, b) => load(a.day) - load(b.day) || a.day - b.day || a.start - b.start);
  const sl = slots[0]!;
  return { day: sl.day, start: toTime(sl.start), end: toTime(sl.end) };
}

/** Dia cumprido: todas as sessões planejadas daquele dia concluídas no próprio dia. */
function dayFulfilled(state: State, date: Date): boolean | null {
  const list = sessionsForDate(state, date);
  if (!list.length) return null; // dia sem sessões não conta nem quebra
  return list.every((s) => s.status === "done" && !!s.completedAt && dayKey(new Date(s.completedAt)) === dayKey(date));
}

/** Dias seguidos: incrementa a cada dia cumprido; zera se o dia anterior não foi cumprido. */
export function streakOf(state: State, now = new Date()) {
  let streak = 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dayFulfilled(state, today) === true) streak++;
  const cur = new Date(today);
  for (let i = 0; i < 366; i++) {
    cur.setDate(cur.getDate() - 1);
    const ok = dayFulfilled(state, cur);
    if (ok === false) break;
    if (ok === true) streak++;
    if (ok === null && !Object.values(state.weeks ?? {}).some((w) => w.length) && !state.sessions.length) break;
    if (cur < new Date(today.getTime() - 60 * 86400000) && ok === null) break;
  }
  return streak;
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
