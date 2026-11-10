// components/routine-screen.tsx
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, GradientBox, Legend, PrimaryButton, Screen, SmallButton, shadow } from "./ui";
import {
  DAY_NAMES,
  DAY_SHORT,
  type Session,
  type State,
  canSuggestIncrease,
  dateOfDay,
  dayOffsetDate,
  fmtDate,
  fmtDay,
  fmtHours,
  generate,
  isEarly,
  isOverdue,
  plannedAt,
  sessionsForDate,
  stateForDate,
  stats,
  streakOf,
  toMin,
  weekIndexOf,
} from "../lib/rotina";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { calendarOffsets } from "../lib/calendar";
import { colors, fonts, radius } from "../theme/colors";
import { withAlpha } from "../theme/alpha";

type Props = { state: State; update: (p: Partial<State>) => void; now: Date };

export function RoutineScreen({ state, update, now }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [focusOff, setFocusOff] = useState(0); // dia selecionado, relativo a hoje
  const [calOpen, setCalOpen] = useState(false);
  const [calOff, setCalOff] = useState(0); // início da janela do calendário
  const [selOff, setSelOff] = useState(0); // dia marcado como selecionado

  const subj = (id: string) => state.subjects.find((s) => s.id === id)?.name ?? "Disciplina removida";
  const focusDate = dayOffsetDate(state.weekStart, now, focusOff);
  const focusDay = weekIndexOf(focusDate);
  const viewState = stateForDate(state, focusDate);
  const st = useMemo(() => stats(viewState, now), [state, focusOff, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSession = (weekStart: string, id: string, p: Partial<Session>) => {
    const target = stateForDate(state, new Date(weekStart));
    const sessions = target.sessions.map((s) => (s.id === id ? { ...s, ...p } : s));
    update({
      weeks: { ...state.weeks, [weekStart]: sessions },
      ...(weekStart === state.weekStart ? { sessions } : {}),
    });
  };

  const sorted = [...viewState.sessions].sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
  // apenas o dia focado é exibido (relativo a hoje)
  const windowDates = [dayOffsetDate(state.weekStart, now, focusOff)];
  const lastDate = windowDates[windowDates.length - 1] ?? focusDate;
  const totalMin = viewState.sessions.reduce((a, s) => a + toMin(s.end) - toMin(s.start), 0);
  const overdue = sorted.filter((s) => isOverdue(viewState.weekStart, s, now));
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;

  // HU10 / HU11
  const longMissed = overdue.filter((s) => toMin(s.end) - toMin(s.start) > 30).length;
  let suggestion: { id: string; title: string; text: string; to: number } | null = null;
  if (longMissed >= 2 && state.duration > 30) {
    const to = state.duration === 60 ? 45 : 30;
    suggestion = {
      id: `down-${state.duration}`,
      title: "💡 Que tal ajustar sua rotina?",
      text: `Você não conseguiu concluir algumas sessões de ${state.duration} minutos recentemente. Sugestão: reduzir seus próximos blocos para ${to} minutos.`,
      to,
    };
  } else if (canSuggestIncrease(state, now) && state.duration < 60) {
    const to = state.duration === 30 ? 45 : 60;
    suggestion = {
      id: `up-${state.duration}`,
      title: "💡 Você está indo bem!",
      text: `Você cumpriu todas as sessões da semana passada. Sugestão: aumentar seus próximos blocos de ${state.duration} para ${to} minutos.`,
      to,
    };
  }
  if (suggestion && state.dismissed.includes(suggestion.id)) suggestion = null;
  const sg = suggestion;
  const showingUp = sg?.id.startsWith("up-") ?? false;

  useEffect(() => {
    if (!showingUp) return;
    const at = state.upShownAt ? new Date(state.upShownAt) : null;
    if (!at || now.getTime() - at.getTime() >= 14 * 86400000) update({ upShownAt: now.toISOString() });
  }, [showingUp]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyDuration = (to: number) => {
    const kept = viewState.sessions.filter((s) => s.status === "done" || plannedAt(viewState.weekStart, s) <= now);
    const blocked = kept.map((s) => ({ day: s.day, start: toMin(s.start), end: toMin(s.end) }));
    const fresh = generate(state.days, state.subjects, to, blocked, now, viewState.weekStart);
    const sessions = [...kept, ...fresh];
    update({
      duration: to,
      weeks: { ...state.weeks, [viewState.weekStart]: sessions },
      ...(viewState.weekStart === state.weekStart ? { sessions } : {}),
    });
  };

  const pickDay = (o: number) => {
    setSelOff(o);
    setFocusOff(o);
    setOpen(null);
    setCalOpen(false);
  };

  return (
    <Screen
      title={focusOff === 0 ? "Sua rotina — hoje" : `Sua rotina — ${DAY_NAMES[focusDay]?.toLowerCase()}`}
      subtitle={`${fmtDay(focusDate)} a ${fmtDay(lastDate)}`}
      action={
        <Pressable
          onPress={() => setCalOpen(!calOpen)}
          accessibilityLabel="Abrir calendário"
          style={[styles.calBtn, calOpen && styles.calBtnActive]}
        >
          <Text style={styles.calBtnIcon}>📅</Text>
        </Pressable>
      }
      footer={<PrimaryButton onPress={() => update({ step: "availability" })}>Ajustar rotina</PrimaryButton>}
    >
      <CalendarModal
        visible={calOpen}
        onClose={() => setCalOpen(false)}
        state={state}
        now={now}
        calOff={calOff}
        setCalOff={setCalOff}
        selOff={selOff}
        onPick={pickDay}
      />

      {/* Resumo */}
      <GradientBox style={styles.summary}>
        <Text style={styles.summaryTitle}>{fmtHours(totalMin)}h de estudo planejadas</Text>
        <Text style={styles.summarySub}>
          {st.total} blocos de {state.duration} minutos · semana de {fmtDate(new Date(viewState.weekStart))}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.summaryFoot}>
          <Text style={styles.summaryFootText}>
            {st.done} de {st.total} sessões concluídas
            {st.early ? ` · ${st.early} antecipada${st.early > 1 ? "s" : ""}` : ""}
          </Text>
          <Text style={styles.summaryFootText}>{pct}%</Text>
        </View>
      </GradientBox>

      {/* Estatísticas */}
      <View style={styles.statsRow}>
        <Stat value={st.days} label="dias estudados" ring />
        <Stat value={st.missed} label="não realizadas" warn />
        <Stat value={streakOf(state, now)} label="dias seguidos" flame />
      </View>

      {/* Sugestão */}
      {sg ? (
        <Card style={styles.suggestion}>
          <Text style={styles.suggestionTitle}>{sg.title}</Text>
          <Text style={styles.suggestionText}>{sg.text}</Text>
          <View style={styles.suggestionActions}>
            <SmallButton label="Aceitar" onPress={() => applyDuration(sg.to)} />
            <SmallButton
              label="Ignorar"
              variant="outline"
              onPress={() => update({ dismissed: [...state.dismissed, sg.id] })}
            />
          </View>
        </Card>
      ) : null}

      {/* Sessões do dia */}
      {windowDates.map((date) => {
        const d = weekIndexOf(date);
        const dayState = stateForDate(state, date);
        const list = sessionsForDate(state, date).sort((a, b) => toMin(a.start) - toMin(b.start));
        if (!list.length) return null;
        const allDone = list.every((s) => s.status === "done");
        return (
          <View key={date.toISOString()} accessibilityLabel={fmtDate(date)}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>
                {date.toDateString() === now.toDateString() ? "Hoje" : DAY_NAMES[d]?.split("-")[0]}
              </Text>
              <Text style={styles.sectionDate}>· {fmtDay(date)}</Text>
              {allDone ? (
                <View style={styles.allDone}>
                  <Text style={styles.allDoneText}>✓ tudo concluído</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.list}>
              {list.map((it, idx) => (
                <SessionRow
                  key={it.id}
                  first={idx === 0}
                  s={it}
                  state={dayState}
                  now={now}
                  name={subj(it.subjectId)}
                  open={open === it.id}
                  onToggle={() => setOpen(open === it.id ? null : it.id)}
                  onDone={() => {
                    setSession(dayState.weekStart, it.id, { status: "done", completedAt: new Date().toISOString() });
                    setOpen(null);
                  }}
                  onUndo={() => {
                    setSession(dayState.weekStart, it.id, { status: "pending", completedAt: undefined });
                    setOpen(null);
                  }}
                />
              ))}
            </View>
          </View>
        );
      })}

      {!windowDates.some((date) => sessionsForDate(state, date).length > 0) ? (
        <Card>
          <Text style={styles.empty}>Nenhuma sessão registrada neste período.</Text>
        </Card>
      ) : null}

      <View style={styles.legends}>
        <Legend color={colors.success} label="Concluída no horário" />
        <Legend color={colors.early} label="Concluída antecipadamente" />
        <Legend color={colors.warning} label="Não realizada" />
      </View>

      <Pressable onPress={() => update({ step: "subjects" })} hitSlop={8}>
        <Text style={styles.editLink}>Editar disciplinas e duração</Text>
      </Pressable>
    </Screen>
  );
}

/* ---------- Calendário (Modal no lugar do popover absoluto) ---------- */

function CalendarModal({
  visible,
  onClose,
  state,
  now,
  calOff,
  setCalOff,
  selOff,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  state: State;
  now: Date;
  calOff: number;
  setCalOff: (n: number) => void;
  selOff: number;
  onPick: (offset: number) => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = Math.min(344, width - 40);
  const rangeStart = dayOffsetDate(state.weekStart, now, Math.min(calOff, 0));
  const rangeEnd = dayOffsetDate(state.weekStart, now, calOff < 0 ? 0 : 7);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { paddingTop: insets.top + 76 }]}
        onPress={onClose}
        accessibilityLabel="Fechar calendário"
      >
        {/* Pressable interno evita fechar ao tocar dentro do cartão */}
        <Pressable style={[styles.calCard, { width: cardWidth }]} onPress={() => {}}>
          <View style={styles.calHead}>
            <View>
              <Text style={styles.calTitle}>ESCOLHA O DIA</Text>
              <Text style={styles.calRange}>
                {fmtDay(rangeStart)} a {fmtDay(rangeEnd)}
              </Text>
            </View>
            <View style={styles.calNav}>
              <Pressable
                onPress={() => setCalOff(-7)}
                disabled={calOff < 0}
                accessibilityLabel="Ver os 7 dias anteriores"
                style={[styles.navBtn, calOff < 0 && styles.navDisabled]}
              >
                <ArrowLeft size={14} color={colors.foreground} />
         
              </Pressable>
              <Pressable
                onPress={() => setCalOff(0)}
                disabled={calOff >= 0}
                accessibilityLabel="Voltar aos dias à frente"
                style={[styles.navBtn, calOff >= 0 && styles.navDisabled]}
              >
                <ArrowRight size={14} color={colors.foreground} />
              </Pressable>
            </View>
          </View>

          <View style={styles.grid}>
            {calendarOffsets(calOff < 0).map((o) => {
              const date = dayOffsetDate(state.weekStart, now, o);
              const d = weekIndexOf(date);
              const calendarState = stateForDate(state, date);
              const list = sessionsForDate(state, date);
              const allDone = list.length > 0 && list.every((s) => s.status === "done");
              const hasMissed = list.some((s) => isOverdue(calendarState.weekStart, s, now));
              const selected = o === selOff;
              const isToday = o === 0;

              const bg = selected
                ? colors.primary
                : allDone
                  ? colors.successSoft
                  : hasMissed
                    ? colors.warningSoft
                    : colors.muted;
              const fg = selected
                ? colors.primaryForeground
                : allDone
                  ? colors.success
                  : hasMissed
                    ? colors.warning
                    : colors.mutedForeground;

              return (
                <Pressable
                  key={o}
                  accessibilityLabel={fmtDate(date)}
                  accessibilityState={{ selected }}
                  onPress={() => onPick(o)}
                  style={[styles.cell, { backgroundColor: bg }]}
                >
                  <Text style={[styles.cellDay, { color: fg }]}>{DAY_SHORT[d]}</Text>
                  <View style={[styles.cellNum, isToday && !selected && styles.cellToday]}>
                    <Text style={[styles.cellNumText, { color: fg }]}>{date.getDate()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.calLegend}>
            <Legend color={colors.success} label="Tudo concluído" />
            <Legend color={colors.warning} label="Pendências" />
            <Legend ring label="Hoje" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Componentes menores ---------- */

function Stat({
  value,
  label,
  ring,
  flame,
  warn,
}: {
  value: number;
  label: string;
  ring?: boolean;
  flame?: boolean;
  warn?: boolean;
}) {
  const tone = warn ? colors.warning : colors.primary;
  return (
    <Card style={styles.stat}>
      <View
        style={[
          styles.statCircle,
          { borderColor: warn ? withAlpha(colors.warning, 0.4) : colors.primary },
          ring && { backgroundColor: colors.primarySoft },
        ]}
      >
        {flame ? <Text style={styles.flame}>🔥</Text> : null}
        <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function SessionRow({
  s,
  state,
  now,
  name,
  open,
  first,
  onToggle,
  onDone,
  onUndo,
}: {
  s: Session;
  state: State;
  now: Date;
  name: string;
  open: boolean;
  first: boolean;
  onToggle: () => void;
  onDone: () => void;
  onUndo: () => void;
}) {
  const early = isEarly(state.weekStart, s);
  const overdue = isOverdue(state.weekStart, s, now);
  const future = plannedAt(state.weekStart, s) > now;
  const planned = `${fmtDate(dateOfDay(state.weekStart, s.day))} · ${s.start}`;
  const done = s.status === "done";

  const tone = done
    ? early
      ? { borderLeftColor: colors.early, backgroundColor: withAlpha(colors.earlySoft, 0.6) }
      : { borderLeftColor: colors.success, backgroundColor: withAlpha(colors.successSoft, 0.6) }
    : overdue
      ? { borderLeftColor: colors.warning, backgroundColor: withAlpha(colors.warningSoft, 0.6) }
      : { borderLeftColor: "transparent" };

  const checkColor = early ? colors.early : colors.success;

  return (
    <View style={[styles.row, !first && styles.rowDivider, tone]}>
      <Pressable onPress={onToggle} style={styles.rowMain} accessibilityRole="button">
        <Text style={styles.rowTime}>
          {s.start} - {s.end}
        </Text>

        <View style={styles.rowBody}>
          <Text style={[styles.rowName, done && styles.rowNameDone]}>{name}</Text>
          <View style={styles.badges}>
            {done && !early ? (
              <Badge bg={colors.successSoft} color={colors.success}>
                ✓ Concluída
              </Badge>
            ) : null}
            {early ? (
              <Badge bg={colors.earlySoft} color={colors.early}>
                ⏩ Antecipada
              </Badge>
            ) : null}
            {overdue ? (
              <Badge bg={colors.warningSoft} color={colors.warning}>
                ⚠️ Não realizada
              </Badge>
            ) : null}
            {s.rescheduledFrom ? (
              <Badge bg={colors.muted} color={colors.mutedForeground}>
                {`Remarcada de ${s.rescheduledFrom}`}
              </Badge>
            ) : null}
          </View>
          {done && s.completedAt ? (
            <Text style={styles.rowMeta}>
              Planejada: {planned} · Realizada: {fmtDate(new Date(s.completedAt))}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.check,
            done ? { borderColor: checkColor, backgroundColor: checkColor } : { borderColor: colors.input },
          ]}
        >
          {done ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
      </Pressable>

      {open ? (
        <View style={styles.rowActions}>
          {!done ? (
            <SmallButton label={future ? "Concluir antecipadamente" : "Marcar como concluída"} onPress={onDone} />
          ) : null}
          {s.status !== "pending" ? <SmallButton label="Desfazer" variant="outline" onPress={onUndo} /> : null}
          {future && !done ? (
            <Text style={styles.futureNote}>
              Planejada para {planned}. Concluir agora registra como antecipada, sem gerar atraso.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /* header action */
  calBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  calBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  calBtnIcon: { fontSize: 18 },

  /* resumo */
  summary: { padding: 16 },
  summaryTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.primaryForeground },
  summarySub: { fontFamily: fonts.regular, fontSize: 12, color: colors.primaryForeground, opacity: 0.85 },
  track: {
    marginTop: 12,
    height: 8,
    overflow: "hidden",
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.primaryForeground, 0.25),
  },
  fill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.primaryForeground },
  summaryFoot: { marginTop: 6, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  summaryFootText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.primaryForeground, opacity: 0.9 },

  /* stats */
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, alignItems: "center", padding: 12 },
  statCircle: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 4,
  },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 22,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  flame: { position: "absolute", top: -16, fontSize: 16 },
  statLabel: {
    marginTop: 6,
    textAlign: "center",
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.mutedForeground,
  },

  /* sugestão */
  suggestion: { borderColor: withAlpha(colors.primary, 0.3), backgroundColor: colors.primarySoft },
  suggestionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.foreground },
  suggestionText: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  suggestionActions: { marginTop: 12, flexDirection: "row", gap: 8 },

  /* lista do dia */
  sectionHead: { marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.secondaryForeground,
  },
  sectionDate: { fontFamily: fonts.semibold, fontSize: 12, color: colors.mutedForeground },
  allDone: { borderRadius: radius.full, backgroundColor: colors.successSoft, paddingHorizontal: 8, paddingVertical: 2 },
  allDoneText: { fontFamily: fonts.bold, fontSize: 10, color: colors.success },
  list: {
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.mutedForeground },

  /* linha de sessão */
  row: { borderLeftWidth: 4 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowTime: { width: 96, fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  rowBody: { flex: 1 },
  rowName: { fontFamily: fonts.bold, fontSize: 14, color: colors.foreground },
  rowNameDone: { color: colors.mutedForeground, textDecorationLine: "line-through" },
  badges: { marginTop: 4, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  rowMeta: { marginTop: 4, fontFamily: fonts.regular, fontSize: 11, color: colors.mutedForeground },
  check: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 2,
  },
  checkMark: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
    color: colors.primaryForeground,
  },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  futureNote: { width: "100%", fontFamily: fonts.regular, fontSize: 11, color: colors.mutedForeground },

  legends: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4 },
  editLink: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },

  /* modal do calendário */
  backdrop: { flex: 1, alignItems: "flex-end", paddingHorizontal: 20, backgroundColor: "rgba(0,0,0,0.25)" },
  calCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    ...shadow.md,
  },
  calHead: { marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  calTitle: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, color: colors.mutedForeground },
  calRange: { fontFamily: fonts.regular, fontSize: 10, color: colors.mutedForeground },
  calNav: { flexDirection: "row", gap: 4 },
  navBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navDisabled: { opacity: 0.3 },
  navText: { fontFamily: fonts.bold, fontSize: 14, color: colors.foreground, marginBottom: 5},
  grid: { flexDirection: "row", gap: 4 },
  cell: { flex: 1, alignItems: "center", borderRadius: radius.lg, paddingVertical: 6 },
  cellDay: { fontFamily: fonts.bold, fontSize: 10 },
  cellNum: {
    marginTop: 2,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cellToday: { borderColor: colors.primary },
  cellNumText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  calLegend: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 },
});