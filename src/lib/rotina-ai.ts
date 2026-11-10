import {
    PRIORITY_WEIGHT,
    SESSION_GAP,
    buildSlots,
    generate,
    plannedAt,
    toTime,
    uid,
    type Day,
    type Session,
    type Slot,
    type Subject,
  } from "./rotina";
  
  /* -------------------------------------------------------------------------- */
  /*                                Configuração                                */
  /* -------------------------------------------------------------------------- */
  
  // IMPORTANTE: nunca coloque a chave da API no app. Este endpoint deve ser um
  // proxy seu (Edge Function, Worker, backend...) que repassa o corpo para
  // https://api.anthropic.com/v1/messages adicionando a chave no servidor.
  const LLM_ENDPOINT = process.env.EXPO_PUBLIC_LLM_ENDPOINT ?? "";
  const LLM_MODEL = "gemini-3.1-flash-lite";
  const LLM_TIMEOUT_MS = 25_000;
  const HISTORY_WINDOW_DAYS = 7;
  const DAY_MS = 24 * 60 * 60 * 1000;
  
  const WEEKDAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
  
  /* -------------------------------------------------------------------------- */
  /*                                    Tipos                                   */
  /* -------------------------------------------------------------------------- */
  
  /** Sessões de uma semana (identificada pelo mesmo `weekStart` usado em `plannedAt`). */
  export type HistoryWeek = { weekStart: string; sessions: Session[] };
  
  export type Situation = "done" | "missed" | "overdue" | "upcoming";
  
  type PlanItem = { slot: number; subjectId: string; review: boolean };
  
  export type GenerateOptions = {
    days: Day[];
    subjects: Subject[];
    duration: number;
    blocked?: Slot[];
    /** Só gera sessões depois deste instante (igual ao `after` original). */
    after?: Date;
    weekStart: string;
    /** Sessões da semana atual e das semanas vizinhas; a função filtra ±7 dias. */
    history?: HistoryWeek[];
    now?: Date;
    endpoint?: string;
    signal?: AbortSignal;
  };
  
  export type GenerateResult = { sessions: Session[]; source: "llm" | "fallback" };
  
  /* -------------------------------------------------------------------------- */
  /*                                   Helpers                                  */
  /* -------------------------------------------------------------------------- */
  
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  
  type SubjectStats = {
    id: string;
    name: string;
    priority: Subject["priority"];
    weight: number;
    done: number;
    doneReviews: number;
    missed: number;
    overdue: number;
    upcoming: number;
    lastDoneDate: string | null;
  };
  
  type HistoryEntry = {
    date: string;
    start: string;
    end: string;
    subjectId: string;
    review: boolean;
    situation: Situation;
  };
  
  /**
   * Classifica cada sessão da janela [agora-7d, agora+7d]:
   * - done: concluída
   * - missed: marcada como perdida
   * - overdue: ainda "pending", mas o horário já passou (não foi realizada)
   * - upcoming: pendente e ainda no futuro
   */
  function summarizeHistory(history: HistoryWeek[], subjects: Subject[], now: Date) {
    const from = now.getTime() - HISTORY_WINDOW_DAYS * DAY_MS;
    const to = now.getTime() + HISTORY_WINDOW_DAYS * DAY_MS;
  
    const stats: Record<string, SubjectStats> = {};
    for (const s of subjects) {
      stats[s.id] = {
        id: s.id,
        name: s.name,
        priority: s.priority,
        weight: PRIORITY_WEIGHT[s.priority],
        done: 0,
        doneReviews: 0,
        missed: 0,
        overdue: 0,
        upcoming: 0,
        lastDoneDate: null,
      };
    }
  
    const entries: HistoryEntry[] = [];
  
    for (const week of history) {
      for (const s of week.sessions) {
        const startAt = plannedAt(week.weekStart, { day: s.day, start: s.start });
        const endAt = plannedAt(week.weekStart, { day: s.day, start: s.end });
        if (endAt.getTime() < from || startAt.getTime() > to) continue;
  
        let situation: Situation;
        if (s.status === "done") situation = "done";
        else if (s.status === "missed") situation = "missed";
        else if (endAt.getTime() <= now.getTime()) situation = "overdue";
        else situation = "upcoming";
  
        const date = ymd(startAt);
        entries.push({ date, start: s.start, end: s.end, subjectId: s.subjectId, review: s.review, situation });
  
        const st = stats[s.subjectId];
        if (!st) continue; // matéria removida
        if (situation === "done") {
          st.done += 1;
          if (s.review) st.doneReviews += 1;
          if (!st.lastDoneDate || date > st.lastDoneDate) st.lastDoneDate = date;
        } else if (situation === "missed") st.missed += 1;
        else if (situation === "overdue") st.overdue += 1;
        else st.upcoming += 1;
      }
    }
  
    entries.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    return { stats: Object.values(stats), entries };
  }
  
  /* -------------------------------------------------------------------------- */
  /*                                   Prompt                                   */
  /* -------------------------------------------------------------------------- */
  
  const SYSTEM_PROMPT = `Você é um planejador de rotinas de estudo. Receberá em JSON: a data/hora atual, as matérias (com prioridade/dificuldade), as estatísticas dos últimos e próximos 7 dias por matéria, o histórico de sessões e uma lista de horários livres ("slots").
  Sua tarefa é decidir, para CADA slot, qual matéria estudar e se a sessão é de revisão.
  
  Regras:
  1. Cubra todos os slots, exatamente uma vez cada. Use somente ids de matéria fornecidos.
  2. Distribua o tempo proporcionalmente ao peso da prioridade (alta=3, media=2, baixa=1). Matérias de prioridade alta são as mais difíceis e merecem mais tempo.
  3. Ajuste pelo histórico:
     - Sessões "missed" ou "overdue" significam conteúdo NÃO estudado: compense dando mais slots a essa matéria, de preferência nos primeiros slots disponíveis, como estudo novo (review=false).
     - Matérias com muitas sessões "done" recentemente podem receber menos tempo; matérias sem estudo há muitos dias devem subir de prioridade.
     - Sessões "upcoming" já estão planejadas: considere-as como carga existente e não duplique a mesma matéria em excesso.
  4. Revisões (review=true): use aproximadamente 20% dos slots (pelo menos 1 se houver 3 ou mais slots), preferindo os últimos slots. Revise apenas matérias que já foram estudadas (sessão "done" no histórico ou estudo agendado antes no próprio plano) e em um dia diferente do estudo mais recente dela. Priorize matérias de prioridade alta e estudadas há 1 a 3 dias.
  5. Evite a mesma matéria em slots consecutivos e evite mais de 2 sessões da mesma matéria no mesmo dia, quando houver alternativa.
  
  Responda SOMENTE com um array JSON, sem texto extra e sem markdown, neste formato:
  [{"slot":0,"subjectId":"<id>","review":false}]`;
  
  function buildUserPayload(
    now: Date,
    subjects: Subject[],
    stats: SubjectStats[],
    entries: HistoryEntry[],
    slots: { slot: number; date: string; weekday: string; start: string; end: string }[],
  ) {
    return JSON.stringify({
      now: { date: ymd(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}` },
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, priority: s.priority, weight: PRIORITY_WEIGHT[s.priority] })),
      stats,
      history: entries,
      slots,
    });
  }
  
  /* -------------------------------------------------------------------------- */
  /*                                Chamada à LLM                               */
  /* -------------------------------------------------------------------------- */
  
  async function callLLM(endpoint: string, userContent: string, maxTokens: number, signal?: AbortSignal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
  
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: LLM_MODEL,
          max_tokens: maxTokens,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      return (data.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  
  /** Extrai e valida o array. Retorna null se faltar qualquer slot ou houver ids inválidos. */
  function parsePlan(text: string, slotCount: number, subjectIds: Set<string>): PlanItem[] | null {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end <= start) return null;
  
    let raw: unknown;
    try {
      raw = JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
    if (!Array.isArray(raw)) return null;
  
    const bySlot = new Map<number, PlanItem>();
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const { slot, subjectId, review } = item as Record<string, unknown>;
      if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot >= slotCount) continue;
      if (typeof subjectId !== "string" || !subjectIds.has(subjectId)) continue;
      if (!bySlot.has(slot)) bySlot.set(slot, { slot, subjectId, review: review === true });
    }
  
    if (bySlot.size !== slotCount) return null;
    return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
  }
  
  /* -------------------------------------------------------------------------- */
  /*                                 Função principal                           */
  /* -------------------------------------------------------------------------- */
  
  /**
   * Gera as sessões de estudo/revisão com apoio de uma LLM.
   * Se o endpoint não estiver configurado, a chamada falhar ou a resposta for inválida,
   * usa o algoritmo determinístico original (`generate`).
   */
  export async function generateWithLLM(opts: GenerateOptions): Promise<GenerateResult> {
    const { days, subjects, duration, blocked = [], after, weekStart, history = [], signal } = opts;
    const now = opts.now ?? new Date();
    const endpoint = opts.endpoint ?? LLM_ENDPOINT;
  
    const fallback = (): GenerateResult => ({
      sessions: generate(days, subjects, duration, blocked, after, weekStart),
      source: "fallback",
    });
  
    // 1) Slots livres: mesma lógica do algoritmo original (disponibilidade + bloqueios + "after")
    let slots = buildSlots(days, duration).filter(
      (s) => !blocked.some((b) => b.day === s.day && s.start < b.end + SESSION_GAP && b.start < s.end + SESSION_GAP),
    );
    if (after) slots = slots.filter((s) => plannedAt(weekStart, { day: s.day, start: toTime(s.start) }) > after);
    slots = [...slots].sort((a, b) => a.day - b.day || a.start - b.start);
  
    if (!subjects.length || !slots.length) return { sessions: [], source: "llm" };
    if (!endpoint) return fallback();
  
    try {
      // 2) Contexto: situação das sessões em ±7 dias
      const { stats, entries } = summarizeHistory(history, subjects, now);
  
      const slotPayload = slots.map((s, i) => {
        const start = toTime(s.start);
        return {
          slot: i,
          date: ymd(plannedAt(weekStart, { day: s.day, start })),
          weekday: WEEKDAYS[s.day] ?? String(s.day),
          start,
          end: toTime(s.end),
        };
      });
  
      const content = buildUserPayload(now, subjects, stats, entries, slotPayload);
      const text = await callLLM(endpoint, content, Math.min(8000, 400 + slots.length * 40), signal);
  
      // 3) Validação
      const subjectIds = new Set(subjects.map((s) => s.id));
      const plan = parsePlan(text, slots.length, subjectIds);
      if (!plan) return fallback();
  
      // Garantia extra: só é revisão se a matéria já foi estudada (histórico ou plano anterior)
      const studied = new Set(stats.filter((s) => s.done > 0).map((s) => s.id));
      const sessions: Session[] = plan.map((item) => {
        const slot = slots[item.slot]!;
        const review = item.review && studied.has(item.subjectId);
        if (!item.review) studied.add(item.subjectId);
        return {
          id: uid(),
          day: slot.day,
          start: toTime(slot.start),
          end: toTime(slot.end),
          subjectId: item.subjectId,
          review,
          status: "pending",
        };
      });
  
      return { sessions, source: "llm" };
    } catch (err) {
      if (signal?.aborted) throw err; // cancelamento pedido pelo chamador
      console.warn("[rotina-ai] falha na LLM, usando algoritmo padrão:", err);
      return fallback();
    }
  }