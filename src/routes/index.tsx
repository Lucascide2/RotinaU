import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DAY_NAMES, DAY_SHORT, PRIORITY_LABEL, type Priority, type Session, type State,
  dateOfDay, dayOffsetDate, defaultState, fmtDate, fmtDay, generate,
  isEarly, isOverdue, plannedAt, stats, toMin, uid, weekIndexOf, prepareWeeks, stateForDate, sessionsForDate,
} from "@/lib/rotina";
import { calendarOffsets } from "@/lib/calendar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RotinaU — Planejador de estudos" },
      { name: "description", content: "Monte uma rotina semanal de estudos baseada na sua disponibilidade real e nas prioridades das disciplinas." },
      { property: "og:title", content: "RotinaU — Planejador de estudos" },
      { property: "og:description", content: "Rotina semanal de estudos com revisões, progresso e sequência de dias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const KEY = "rotinau-v1";

function Index() {
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let s: State;
    try { s = JSON.parse(localStorage.getItem(KEY) ?? "") as State; } catch { s = defaultState(); }
    if (!s?.days) s = defaultState();
    setState(prepareWeeks(s, new Date()));
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (state) localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);

  if (!state) return <Shell><div /></Shell>;
   const update = (p: Partial<State>) => setState((s) => s ? prepareWeeks({ ...s, ...p }, new Date()) : s);

  return (
    <Shell>
      {state.step === "intro" && <Intro onStart={() => update({ step: state.sessions.length ? "routine" : "availability" })} />}
      {state.step === "availability" && <Availability state={state} update={update} />}
      {state.step === "subjects" && <Subjects state={state} update={update} />}
      {state.step === "routine" && <Routine state={state} update={update} now={now} />}
    </Shell>
  );
}

/* ---------- UI primitives ---------- */

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen sm:py-8">
      <div className="mx-auto flex min-h-screen max-w-[420px] flex-col bg-background sm:min-h-[820px] sm:rounded-3xl sm:border sm:shadow-xl">
        {children}
      </div>
    </main>
  );
}
function Screen({ title, subtitle, children, footer, onBack, action }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; onBack?: () => void; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col px-5 pb-5 pt-7">
      {onBack && <button onClick={onBack} className="mb-3 self-start text-sm font-semibold text-primary">← Voltar</button>}
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {action}
      </div>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-5 flex flex-1 flex-col gap-3">{children}</div>
      {footer && <div className="sticky bottom-0 mt-6 bg-background pt-3">{footer}</div>}
    </div>
  );
}
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card p-4 shadow-sm ${className}`}>{children}</div>;
}
function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-40">
      {children}
    </button>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition ${on ? "bg-primary" : "bg-input"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/* ---------- Tela 1 ---------- */

function Intro({ onStart }: { onStart: () => void }) {
  const items = [
    ["Disponibilidade", "Informe quando você realmente pode estudar."],
    ["Prioridades", "Marque a dificuldade de cada disciplina."],
    ["Rotina sugerida", "Receba uma divisão semanal editável."],
  ];
  return (
    <div className="flex flex-1 flex-col px-5 pb-5 pt-6">
      <div className="rounded-2xl bg-gradient-primary px-5 py-4 text-primary-foreground">
        <div className="text-3xl font-extrabold">RotinaU</div>
        <div className="text-sm opacity-85">Planejador de estudos</div>
      </div>
      <h1 className="mt-8 text-2xl font-bold tracking-tight">Organize seu tempo de estudo</h1>
      <p className="mt-1 text-sm text-muted-foreground">Monte uma rotina semanal de acordo com a sua disponibilidade real e com as disciplinas que exigem mais atenção.</p>
      <div className="mt-6 flex flex-1 flex-col gap-3">
        {items.map(([t, d]) => (
          <Card key={t} className="flex gap-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary-soft"><span className="h-2.5 w-2.5 rounded-full bg-primary" /></span>
            <div><div className="font-bold">{t}</div><div className="text-xs text-muted-foreground">{d}</div></div>
          </Card>
        ))}
      </div>
      <div className="mt-6"><PrimaryButton onClick={onStart}>Começar planejamento</PrimaryButton></div>
    </div>
  );
}

/* ---------- Tela 2 (HU01) ---------- */

function Availability({ state, update }: { state: State; update: (p: Partial<State>) => void }) {
  const setDay = (i: number, p: Partial<State["days"][number]>) =>
    update({ days: state.days.map((d, j) => (j === i ? { ...d, ...p } : d)) });
  const valid = state.days.some((d) => d.enabled && toMin(d.end) - toMin(d.start) >= 30);
  return (
    <Screen title="Sua disponibilidade" subtitle="Selecione os períodos em que você realmente consegue estudar."
      onBack={() => update({ step: "intro" })}
      footer={<PrimaryButton disabled={!valid} onClick={() => update({ step: "subjects" })}>Continuar</PrimaryButton>}>
      {state.days.map((d, i) => {
        const bad = d.enabled && toMin(d.end) <= toMin(d.start);
        return (
          <Card key={i}>
            <div className="flex items-center justify-between">
              <span className="font-bold">{DAY_NAMES[i]}</span>
              <Toggle on={d.enabled} onChange={(v) => setDay(i, { enabled: v })} />
            </div>
            {d.enabled ? (
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-primary">
                <input type="time" step={900} value={d.start} onChange={(e) => setDay(i, { start: e.target.value })} className="rounded-md bg-primary-soft px-2 py-1 outline-none" />
                <span>até</span>
                <input type="time" step={900} value={d.end} onChange={(e) => setDay(i, { end: e.target.value })} className="rounded-md bg-primary-soft px-2 py-1 outline-none" />
              </div>
            ) : <div className="mt-2 text-xs text-muted-foreground">Sem disponibilidade</div>}
            {bad && <div className="mt-1 text-xs text-destructive">O horário final deve ser depois do inicial.</div>}
          </Card>
        );
      })}
    </Screen>
  );
}

/* ---------- Tela 3 (HU02-04) ---------- */

const PRIO_CLASS: Record<Priority, string> = { alta: "bg-high", media: "bg-medium", baixa: "bg-low" };
const NEXT: Record<Priority, Priority> = { baixa: "media", media: "alta", alta: "baixa" };

function Subjects({ state, update }: { state: State; update: (p: Partial<State>) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const setSub = (id: string, p: Partial<State["subjects"][number]>) =>
    update({ subjects: state.subjects.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const add = () => { const id = uid(); update({ subjects: [...state.subjects, { id, name: "Nova disciplina", priority: "media" }] }); setEditing(id); };
  const gen = () => update({ step: "routine", dismissed: [], sessions: generate(state.days, state.subjects.filter((s) => s.name.trim()), state.duration) });
  return (
    <Screen title="Disciplinas e prioridades" subtitle="Adicione as disciplinas e indique onde precisa dedicar mais esforço."
      onBack={() => update({ step: "availability" })}
      footer={<PrimaryButton disabled={!state.subjects.length} onClick={gen}>{state.sessions.length ? "Gerar novo planejamento" : "Gerar planejamento"}</PrimaryButton>}>
      {state.subjects.map((s) => (
        <Card key={s.id}>
          <div className="flex items-start justify-between gap-2">
            {editing === s.id ? (
              <input autoFocus value={s.name} onChange={(e) => setSub(s.id, { name: e.target.value })} onBlur={() => setEditing(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditing(null)} className="min-w-0 flex-1 rounded-md border px-2 py-1 font-bold outline-none focus:border-primary" />
            ) : (
              <button onClick={() => setEditing(s.id)} className="text-left font-bold">{s.name}</button>
            )}
            <div className="flex gap-3 text-xs font-semibold">
              <button onClick={() => setEditing(s.id)} className="text-primary">Editar</button>
              <button onClick={() => update({ subjects: state.subjects.filter((x) => x.id !== s.id) })} className="text-destructive">Excluir</button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Dificuldade</span>
            <div className="flex gap-1">
              {(["baixa", "media", "alta"] as Priority[]).map((p) => (
                <button key={p} onClick={() => setSub(s.id, { priority: p })}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${s.priority === p ? `${PRIO_CLASS[p]} text-primary-foreground` : "bg-muted text-muted-foreground"}`}>
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ))}
      <button onClick={add} className="rounded-xl bg-primary-soft p-4 text-left text-sm font-bold text-secondary-foreground">+ Adicionar disciplina</button>
      <div className="mt-2 text-sm font-bold">Duração das sessões</div>
      <div className="flex gap-2">
        {[30, 45, 60].map((d) => (
          <button key={d} onClick={() => update({ duration: d })}
            className={`flex-1 rounded-lg border py-2 text-xs font-bold transition ${state.duration === d ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
            {d === 60 ? "1 hora" : `${d} min`}
          </button>
        ))}
      </div>
    </Screen>
  );
}

/* ---------- Tela 4 (HU05-16) ---------- */

function Routine({ state, update, now }: { state: State; update: (p: Partial<State>) => void; now: Date }) {
  const [open, setOpen] = useState<string | null>(null);
  const [focusOff, setFocusOff] = useState(0); // dia selecionado, relativo a hoje
  const [calOpen, setCalOpen] = useState(false);
  const [calOff, setCalOff] = useState(0); // início da janela do calendário
  const [selOff, setSelOff] = useState(0); // dia marcado como selecionado
  const subj = (id: string) => state.subjects.find((s) => s.id === id)?.name ?? "Disciplina removida";
  const focusDate = dayOffsetDate(state.weekStart, now, focusOff);
  const focusDay = weekIndexOf(focusDate);
  const viewState = stateForDate(state, focusDate);
  const st = useMemo(() => stats(viewState, now), [state, focusOff, now]);
  const setSession = (weekStart: string, id: string, p: Partial<Session>) => {
    const target = stateForDate(state, new Date(weekStart));
    const sessions = target.sessions.map((s) => s.id === id ? { ...s, ...p } : s);
    update({ weeks: { ...state.weeks, [weekStart]: sessions },
      ...(weekStart === state.weekStart ? { sessions } : {}) });
  };
  const sorted = [...viewState.sessions].sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
  // janela de 3 dias a partir do dia focado (relativa a hoje)
  const focusOffsets = [focusOff, focusOff + 1, focusOff + 2].filter((o) => o >= -7 && o <= 7);
  const windowDates = focusOffsets.map((o) => dayOffsetDate(state.weekStart, now, o));
  const totalMin = viewState.sessions.reduce((a, s) => a + toMin(s.end) - toMin(s.start), 0);
  const overdue = sorted.filter((s) => isOverdue(viewState.weekStart, s, now));
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;

  // HU10 / HU11
  const longMissed = overdue.filter((s) => toMin(s.end) - toMin(s.start) > 30).length;
  let suggestion: { id: string; title: string; text: string; to: number } | null = null;
  if (longMissed >= 2 && state.duration > 30) {
    const to = state.duration === 60 ? 45 : 30;
    suggestion = { id: `down-${state.duration}`, title: "💡 Que tal ajustar sua rotina?", text: `Você não conseguiu concluir algumas sessões de ${state.duration} minutos recentemente. Sugestão: reduzir seus próximos blocos para ${to} minutos.`, to };
  } else if (st.done >= 4 && overdue.length === 0 && state.duration < 60) {
    const to = state.duration === 30 ? 45 : 60;
    suggestion = { id: `up-${state.duration}`, title: "💡 Você está indo bem!", text: `Você tem conseguido cumprir suas sessões regularmente. Sugestão: aumentar seus próximos blocos de ${state.duration} para ${to} minutos.`, to };
  }
  if (suggestion && state.dismissed.includes(suggestion.id)) suggestion = null;

  const applyDuration = (to: number) => {
    const kept = viewState.sessions.filter((s) => s.status === "done" || plannedAt(viewState.weekStart, s) <= now);
    const blocked = kept.map((s) => ({ day: s.day, start: toMin(s.start), end: toMin(s.end) }));
    const fresh = generate(state.days, state.subjects, to, blocked, now, viewState.weekStart);
    const sessions = [...kept, ...fresh];
    update({ duration: to, weeks: { ...state.weeks, [viewState.weekStart]: sessions },
      ...(viewState.weekStart === state.weekStart ? { sessions } : {}) });
  };

  return (
    <Screen title={focusOff === 0 ? "Sua rotina — hoje" : `Sua rotina — ${DAY_NAMES[focusDay]?.toLowerCase()}`}
      subtitle={`${fmtDay(focusDate)} a ${fmtDay(windowDates.at(-1) ?? focusDate)}`}
      action={
        <div className="relative">
          <button onClick={() => setCalOpen(!calOpen)} aria-label="Abrir calendário"
            className={`grid h-10 w-10 place-items-center rounded-xl border text-lg transition ${calOpen ? "border-primary bg-primary-soft" : "bg-card"}`}>📅</button>
          {calOpen && (
            <div role="dialog" aria-label="Calendário de sessões" className="absolute right-0 z-20 mt-2 w-[344px] max-w-[calc(100vw-40px)] rounded-xl border bg-card p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Escolha o dia</div>
                  <div className="text-[10px] text-muted-foreground">{fmtDay(dayOffsetDate(state.weekStart, now, Math.min(calOff, 0)))} a {fmtDay(dayOffsetDate(state.weekStart, now, calOff < 0 ? 0 : 7))}</div>
                </div>
                <div className="flex gap-1">
                <button onClick={() => setCalOff(-7)} disabled={calOff < 0} aria-label="Ver os 7 dias anteriores"
                  className="grid h-7 w-7 place-items-center rounded-lg border text-sm font-bold transition hover:bg-muted disabled:opacity-30">←</button>
                <button onClick={() => setCalOff(0)} disabled={calOff >= 0} aria-label="Voltar aos dias à frente"
                  className="grid h-7 w-7 place-items-center rounded-lg border text-sm font-bold transition hover:bg-muted disabled:opacity-30">→</button>
                </div>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {calendarOffsets(calOff < 0).map((o) => {
                  const date = dayOffsetDate(state.weekStart, now, o);
                  const d = weekIndexOf(date);
                  const calendarState = stateForDate(state, date);
                  const list = sessionsForDate(state, date);
                  const allDone = list.length > 0 && list.every((s) => s.status === "done");
                  const hasMissed = list.some((s) => isOverdue(calendarState.weekStart, s, now));
                  const selected = o === selOff;
                  return (
                    <button key={o} aria-label={fmtDate(date)} aria-current={o === 0 ? "date" : undefined} aria-pressed={selected} onClick={() => { setSelOff(o); setFocusOff(o); setOpen(null); setCalOpen(false); }}
                      className={`flex flex-col items-center rounded-lg py-1.5 text-[10px] font-bold transition
                        ${selected ? "bg-primary text-primary-foreground" : allDone ? "bg-success-soft text-success" : hasMissed ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"}`}>
                      <span>{DAY_SHORT[d]}</span>
                      <span className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[11px] ${o === 0 && !selected ? "ring-2 ring-primary" : ""}`}>
                        {date.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <Legend cls="bg-success" label="Tudo concluído" />
                <Legend cls="bg-warning" label="Pendências" />
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full ring-2 ring-primary" />Hoje</span>
              </div>
            </div>
          )}
        </div>
      }
      footer={<PrimaryButton onClick={() => update({ step: "availability" })}>Ajustar rotina</PrimaryButton>}>
      <div className="rounded-2xl bg-gradient-primary p-4 text-primary-foreground">
        <div className="font-bold">{(totalMin / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h de estudo planejadas</div>
        <div className="text-xs opacity-85">{st.total} blocos de {state.duration} minutos · semana de {fmtDate(new Date(viewState.weekStart))}</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-foreground/25">
          <div className="h-full rounded-full bg-primary-foreground transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs opacity-90">
          <span>{st.done} de {st.total} sessões concluídas{st.early ? ` · ${st.early} antecipada${st.early > 1 ? "s" : ""}` : ""}</span>
          <span>{pct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat value={st.days} label="dias estudados" ring />
        <Stat value={st.streak} label="dias seguidos" flame />
        <Stat value={st.missed} label="não realizadas" warn />
      </div>

      {suggestion && (
        <Card className="border-primary/30 bg-primary-soft">
          <div className="font-bold">{suggestion.title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{suggestion.text}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => applyDuration(suggestion!.to)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Aceitar</button>
            <button onClick={() => update({ dismissed: [...state.dismissed, suggestion!.id] })} className="rounded-lg border bg-card px-3 py-1.5 text-xs font-bold">Ignorar</button>
          </div>
        </Card>
      )}

      {windowDates.map((date) => {
        const d = weekIndexOf(date);
        const dayState = stateForDate(state, date);
        const list = sessionsForDate(state, date).sort((a, b) => toMin(a.start) - toMin(b.start));
        if (!list.length) return null;
        return (
          <section key={date.toISOString()} aria-label={fmtDate(date)}>
            <h2 className="mb-1.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-secondary-foreground">
              {date.toDateString() === now.toDateString() ? "Hoje" : DAY_NAMES[d]?.split("-")[0]}
              <span className="font-semibold text-muted-foreground">· {fmtDay(date)}</span>
              {list.every((s) => s.status === "done") && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] text-success normal-case">✓ tudo concluído</span>}
            </h2>
            <div className="divide-y rounded-xl border bg-card shadow-sm">
              {list.map((it) => (
                  <SessionRow key={it.id} s={it} state={dayState} now={now} name={subj(it.subjectId)} open={open === it.id}
                    onToggle={() => setOpen(open === it.id ? null : it.id)}
                    onDone={() => { setSession(dayState.weekStart, it.id, { status: "done", completedAt: new Date().toISOString() }); setOpen(null); }}
                    onUndo={() => { setSession(dayState.weekStart, it.id, { status: "pending", completedAt: undefined }); setOpen(null); }} />
              ))}
            </div>
          </section>
        );
      })}
      {!windowDates.some((date) => sessionsForDate(state, date).length > 0) && (
        <Card><p className="text-sm text-muted-foreground">Nenhuma sessão registrada neste período.</p></Card>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <Legend cls="bg-success" label="Concluída no horário" />
        <Legend cls="bg-early" label="Concluída antecipadamente" />
        <Legend cls="bg-warning" label="Não realizada" />
        <Legend cls="bg-review" label="Revisão" />
      </div>
      <button onClick={() => update({ step: "subjects" })} className="text-sm font-semibold text-primary">Editar disciplinas e duração</button>
    </Screen>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${cls}`} />{label}</span>;
}

function Stat({ value, label, ring, flame, warn }: { value: number; label: string; ring?: boolean; flame?: boolean; warn?: boolean }) {
  return (
    <Card className="flex flex-col items-center p-3 text-center">
      <div className={`relative grid h-12 w-12 place-items-center rounded-full border-4 text-lg font-extrabold ${warn ? "border-warning/40 text-warning" : "border-primary text-primary"} ${ring ? "bg-primary-soft" : ""}`}>
        {flame && <span className="absolute -top-3 text-base">🔥</span>}
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-medium leading-tight text-muted-foreground">{label}</div>
    </Card>
  );
}

function SessionRow({ s, state, now, name, open, onToggle, onDone, onUndo }: {
  s: Session; state: State; now: Date; name: string; open: boolean;
  onToggle: () => void; onDone: () => void; onUndo: () => void;
}) {
  const early = isEarly(state.weekStart, s);
  const overdue = isOverdue(state.weekStart, s, now);
  const future = plannedAt(state.weekStart, s) > now;
  const planned = `${fmtDate(dateOfDay(state.weekStart, s.day))} · ${s.start}`;
  const tone = s.status === "done" ? (early ? "border-l-early bg-early-soft/60" : "border-l-success bg-success-soft/60") : overdue ? "border-l-warning bg-warning-soft/60" : "border-l-transparent";
  return (
    <div className={`border-l-4 first:rounded-t-xl last:rounded-b-xl ${tone}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="w-24 shrink-0 text-xs text-muted-foreground">{s.start} - {s.end}</span>
        <span className="flex-1">
          <span className={`block text-sm font-bold ${s.status === "done" ? "text-muted-foreground line-through decoration-1" : ""}`}>{name}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {s.review && <Badge cls="bg-review-soft text-review">↻ Revisão</Badge>}
            {s.status === "done" && !early && <Badge cls="bg-success-soft text-success">✓ Concluída</Badge>}
            {early && <Badge cls="bg-early-soft text-early">⏩ Antecipada</Badge>}
            {overdue && <Badge cls="bg-warning-soft text-warning">⚠️ Não realizada</Badge>}
            {s.rescheduledFrom && <Badge cls="bg-muted text-muted-foreground">Remarcada de {s.rescheduledFrom}</Badge>}
          </span>
          {s.status === "done" && s.completedAt && (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Planejada: {planned} · Realizada: {fmtDate(new Date(s.completedAt))}
            </span>
          )}
        </span>
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${s.status === "done" ? (early ? "border-early bg-early text-primary-foreground" : "border-success bg-success text-primary-foreground") : "border-input"}`}>
          {s.status === "done" ? "✓" : ""}
        </span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {s.status !== "done" && (
            <button onClick={onDone} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
              {future ? "Concluir antecipadamente" : "Marcar como concluída"}
            </button>
          )}
          {s.status !== "pending" && <button onClick={onUndo} className="rounded-lg border bg-card px-3 py-1.5 text-xs font-bold">Desfazer</button>}
          {future && s.status !== "done" && <span className="w-full text-[11px] text-muted-foreground">Planejada para {planned}. Concluir agora registra como antecipada, sem gerar atraso.</span>}
        </div>
      )}
    </div>
  );
}

function Badge({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>;
}
