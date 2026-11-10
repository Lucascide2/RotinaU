// components/primitives/calendar.tsx
// Substitui react-day-picker (que é só web) por um calendário mensal próprio.
// Modos: "single" (padrão), "multiple" e "range". O estado `selected` é sempre controlado pelo pai.
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Button, type ButtonVariant } from "./button";
import { useControllableState } from "../../hooks/use-controllable-state";
import { colors, fonts, radius } from "../../theme/colors";

export type DateRange = { from?: Date; to?: Date };

type CommonProps = {
  /** Mês exibido (controlado). */
  month?: Date;
  /** Mês inicial (não controlado). Padrão: hoje. */
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  showOutsideDays?: boolean;
  /** 0 = domingo (padrão do DayPicker), 1 = segunda... */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Retorne true para desabilitar um dia. */
  disabled?: (date: Date) => boolean;
  /** Lado de cada célula (era --cell-size: 2rem). Mantive 40 para facilitar o toque. */
  cellSize?: number;
  buttonVariant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
};
type SingleProps = { mode?: "single"; selected?: Date; onSelect?: (date: Date | undefined) => void };
type MultipleProps = { mode: "multiple"; selected?: Date[]; onSelect?: (dates: Date[] | undefined) => void };
type RangeProps = { mode: "range"; selected?: DateRange; onSelect?: (range: DateRange | undefined) => void };
export type CalendarProps = CommonProps & (SingleProps | MultipleProps | RangeProps);

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

type Band = "start" | "middle" | "end" | null;

export function Calendar(props: CalendarProps) {
  const {
    showOutsideDays = true,
    weekStartsOn = 0,
    disabled,
    cellSize = 40,
    buttonVariant = "ghost",
    style,
  } = props;

  const [month, setMonth] = useControllableState<Date>({
    value: props.month ? startOfMonth(props.month) : undefined,
    defaultValue: startOfMonth(props.defaultMonth ?? new Date()),
    onChange: props.onMonthChange,
  });

  const today = new Date();
  const year = month.getFullYear();
  const m = month.getMonth();

  // Semanas do mês (4 a 6 linhas), como o DayPicker.
  const offset = (new Date(year, m, 1).getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const weekCount = Math.ceil((offset + daysInMonth) / 7);
  const weeks = Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(year, m, 1 - offset + w * 7 + d)),
  );
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStartsOn) % 7]);

  /** Estado visual de um dia conforme o modo. */
  function flagsOf(date: Date): { primary: boolean; middle: boolean; band: Band } {
    if (props.mode === "multiple") {
      return { primary: !!props.selected?.some((d) => isSameDay(d, date)), middle: false, band: null };
    }
    if (props.mode === "range") {
      const from = props.selected?.from ? startOfDay(props.selected.from) : undefined;
      const to = props.selected?.to ? startOfDay(props.selected.to) : undefined;
      const isFrom = !!from && isSameDay(from, date);
      const isTo = !!to && isSameDay(to, date);
      let band: Band = null;
      if (from && to && !isSameDay(from, to)) {
        if (isFrom) band = "start";
        else if (isTo) band = "end";
        else if (date > from && date < to) band = "middle";
      }
      return { primary: isFrom || isTo, middle: band === "middle", band };
    }
    return { primary: !!props.selected && isSameDay(props.selected, date), middle: false, band: null };
  }

  function handlePress(date: Date) {
    if (props.mode === "multiple") {
      const cur = props.selected ?? [];
      const has = cur.some((d) => isSameDay(d, date));
      const next = has ? cur.filter((d) => !isSameDay(d, date)) : [...cur, date];
      props.onSelect?.(next.length ? next : undefined);
    } else if (props.mode === "range") {
      const r = props.selected;
      if (!r?.from || r.to) props.onSelect?.({ from: date, to: undefined }); // começa novo intervalo
      else if (date < startOfDay(r.from)) props.onSelect?.({ from: date, to: r.from });
      else props.onSelect?.({ from: r.from, to: date });
    } else {
      props.onSelect?.(props.selected && isSameDay(props.selected, date) ? undefined : date);
    }
  }

  return (
    <View style={[styles.root, { width: cellSize * 7 + 24 }, style]}>
      {/* Cabeçalho: mês anterior / legenda / próximo mês */}
      <View style={styles.caption}>
        <Button
          variant={buttonVariant}
          size="icon"
          accessibilityLabel="Mês anterior"
          style={{ width: cellSize, height: cellSize }}
          onPress={() => setMonth(addMonths(month, -1))}
        >
          <ChevronLeft size={16} color={colors.foreground} />
        </Button>
        <Text style={styles.captionLabel} accessibilityRole="header">
          {MONTHS[m]} {year}
        </Text>
        <Button
          variant={buttonVariant}
          size="icon"
          accessibilityLabel="Próximo mês"
          style={{ width: cellSize, height: cellSize }}
          onPress={() => setMonth(addMonths(month, 1))}
        >
          <ChevronRight size={16} color={colors.foreground} />
        </Button>
      </View>

      <View style={styles.row}>
        {weekdayLabels.map((label, i) => (
          <Text key={i} style={[styles.weekday, { width: cellSize }]}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={w} style={[styles.row, styles.week]}>
          {week.map((date) => {
            const outside = date.getMonth() !== m;
            if (outside && !showOutsideDays) {
              return <View key={date.getTime()} style={{ width: cellSize, height: cellSize }} />;
            }
            const f = flagsOf(date);
            return (
              <CalendarDayButton
                key={date.getTime()}
                date={date}
                cellSize={cellSize}
                outside={outside}
                disabled={!!disabled?.(date)}
                today={isSameDay(date, today)}
                primary={f.primary}
                middle={f.middle}
                band={f.band}
                onPress={() => handlePress(date)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function CalendarDayButton({
  date,
  cellSize,
  outside,
  disabled,
  today,
  primary,
  middle,
  band,
  onPress,
}: {
  date: Date;
  cellSize: number;
  outside?: boolean;
  disabled?: boolean;
  today?: boolean;
  /** Dia selecionado (single/multiple) ou ponta do intervalo. */
  primary?: boolean;
  /** Dia dentro do intervalo. */
  middle?: boolean;
  band?: Band;
  onPress: () => void;
}) {
  const highlightToday = !!today && !primary && !middle;
  const fg = primary
    ? colors.primaryForeground
    : middle || highlightToday
      ? colors.accentForeground
      : outside || disabled
        ? colors.mutedForeground
        : colors.foreground;

  const bandStyle: ViewStyle | undefined =
    band === "middle"
      ? { backgroundColor: colors.accent }
      : band === "start"
        ? { backgroundColor: colors.accent, borderTopLeftRadius: radius.md, borderBottomLeftRadius: radius.md }
        : band === "end"
          ? { backgroundColor: colors.accent, borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md }
          : undefined;

  const label = `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;

  return (
    <View style={[{ width: cellSize, height: cellSize }, bandStyle]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityState={{ selected: !!(primary || middle), disabled: !!disabled }}
        style={({ pressed }) => [
          styles.day,
          primary && { backgroundColor: colors.primary },
          highlightToday && { backgroundColor: colors.accent },
          !middle && !primary && !highlightToday && pressed && { backgroundColor: colors.accent },
          middle && styles.dayMiddle,
          disabled && styles.dayDisabled,
        ]}
      >
        <Text style={[styles.dayText, { color: fg }]}>{date.getDate()}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: "flex-start", backgroundColor: colors.background, padding: 12 },
  caption: { marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  captionLabel: { flex: 1, textAlign: "center", fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  row: { flexDirection: "row" },
  week: { marginTop: 8 },
  weekday: { textAlign: "center", fontFamily: fonts.regular, fontSize: 12.8, color: colors.mutedForeground },
  day: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  dayMiddle: { borderRadius: 0 },
  dayDisabled: { opacity: 0.5 },
  dayText: { fontFamily: fonts.regular, fontSize: 14 },
});