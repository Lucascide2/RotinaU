// components/availability-screen.tsx
import { StyleSheet, Switch, Text, View } from "react-native";

import { Card, PrimaryButton, Screen } from "./ui";
import { TimeField } from "./time-field";
import { DAY_NAMES, toMin, type State } from "../lib/rotina";
import { colors, fonts } from "../theme/colors";

type Props = { state: State; update: (p: Partial<State>) => void };

export function AvailabilityScreen({ state, update }: Props) {
  const setDay = (i: number, p: Partial<State["days"][number]>) =>
    update({ days: state.days.map((d, j) => (j === i ? { ...d, ...p } : d)) });

  const valid = state.days.some((d) => d.enabled && toMin(d.end) - toMin(d.start) >= 30);

  return (
    <Screen
      title="Sua disponibilidade"
      subtitle="Selecione os períodos em que você realmente consegue estudar."
      onBack={() => update({ step: "intro" })}
      footer={
        <PrimaryButton disabled={!valid} onPress={() => update({ step: "subjects" })}>
          Continuar
        </PrimaryButton>
      }
    >
      {state.days.map((d, i) => {
        const bad = d.enabled && toMin(d.end) <= toMin(d.start);
        return (
          <Card key={i}>
            <View style={styles.row}>
              <Text style={styles.dayName}>{DAY_NAMES[i]}</Text>
              <Switch
                value={d.enabled}
                onValueChange={(v) => setDay(i, { enabled: v })}
                trackColor={{ false: colors.input, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            {d.enabled ? (
              <View style={styles.times}>
                <TimeField value={d.start} onChange={(v) => setDay(i, { start: v })} />
                <Text style={styles.until}>até</Text>
                <TimeField value={d.end} onChange={(v) => setDay(i, { end: v })} />
              </View>
            ) : (
              <Text style={styles.off}>Sem disponibilidade</Text>
            )}

            {bad ? <Text style={styles.error}>O horário final deve ser depois do inicial.</Text> : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { fontFamily: fonts.bold, fontSize: 16, color: colors.foreground },
  times: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  until: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
  off: { marginTop: 8, fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  error: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12, color: colors.destructive },
});