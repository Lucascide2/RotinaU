// components/time-field.tsx
// Substitui <input type="time" step={900}>.
// Requer: npx expo install @react-native-community/datetimepicker
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { colors, fonts, radius } from "../theme/colors";

const toDate = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
};
const toHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);

  const handle = (e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (e.type === "set" && date) onChange(toHHMM(date));
  };

  // iOS: o próprio seletor "compact" já é um botão que abre o popover do sistema.
  if (Platform.OS === "ios") {
    return (
      <DateTimePicker
        value={toDate(value)}
        mode="time"
        display="compact"
        minuteInterval={15}
        accentColor={colors.primary}
        themeVariant="light"
        onChange={handle}
      />
    );
  }

  // Android: botão que abre o diálogo nativo.
  return (
    <>
      <Pressable onPress={() => setShow(true)} style={styles.pill} accessibilityRole="button">
        <Text style={styles.pillText}>{value}</Text>
      </Pressable>
      {show && <DateTimePicker value={toDate(value)} mode="time" is24Hour display="default" onChange={handle} />}
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
});