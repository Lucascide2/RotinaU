// components/time-field.web.tsx
// Seletor em formato de relógio (mostrador circular), sem popup do navegador.
// Hora: anel externo (1-12) e anel interno (13-23 e 00). Minuto: 00, 15, 30, 45.
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { colors, fonts, radius } from "../theme/colors";
import { shadow } from "./ui";

const SIZE = 248; // diâmetro do mostrador
const C = SIZE / 2;
const CELL = 36; // diâmetro de cada número
const R_OUT = 100; // raio do anel externo
const R_IN = 62; // raio do anel interno
const pad = (n: number) => String(n).padStart(2, "0");

type Mode = "hour" | "minute";

export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("hour");
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);

  const openModal = () => {
    const [hh, mm] = value.split(":").map(Number);
    setH(hh || 0);
    setM((Math.round((mm || 0) / 15) * 15) % 60); // arredonda para o passo de 15
    setMode("hour");
    setOpen(true);
  };

  const close = () => setOpen(false);

  const confirm = () => {
    onChange(`${pad(h)}:${pad(m)}`);
    setOpen(false);
  };

  return (
    <>
      <Pressable onPress={openModal} style={styles.pill} accessibilityRole="button" accessibilityLabel="Escolher horário">
        <Text style={styles.pillText}>{value}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fechar">
          {/* Pressable interno evita fechar ao tocar dentro do cartão */}
          <Pressable style={[styles.card, { maxHeight: height - 40 }]} onPress={() => {}}>
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Escolha o horário</Text>

              {/* Cabeçalho: toque em HH ou MM para alternar */}
              <View style={styles.header}>
                <Pressable onPress={() => setMode("hour")} accessibilityRole="button" accessibilityLabel="Escolher hora">
                  <Text style={[styles.headerNum, mode === "hour" && styles.headerActive]}>{pad(h)}</Text>
                </Pressable>
                <Text style={styles.headerColon}>:</Text>
                <Pressable onPress={() => setMode("minute")} accessibilityRole="button" accessibilityLabel="Escolher minuto">
                  <Text style={[styles.headerNum, mode === "minute" && styles.headerActive]}>{pad(m)}</Text>
                </Pressable>
              </View>

              <View style={styles.dialWrap}>
                {mode === "hour" ? (
                  <HourDial
                    value={h}
                    onPick={(x) => {
                      setH(x);
                      setMode("minute"); // avança para os minutos
                    }}
                  />
                ) : (
                  <MinuteDial value={m} onPick={setM} />
                )}
              </View>
            </ScrollView>

            {/* Fora do ScrollView: sempre visível */}
            <View style={styles.actions}>
              <Pressable onPress={close} style={[styles.btn, styles.btnOutline]} accessibilityRole="button">
                <Text style={[styles.btnText, styles.btnTextOutline]}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={confirm} style={[styles.btn, styles.btnPrimary]} accessibilityRole="button">
                <Text style={[styles.btnText, styles.btnTextPrimary]}>OK</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* ---------- Mostrador de horas ---------- */

function HourDial({ value, onPick }: { value: number; onPick: (h: number) => void }) {
  const items: { v: number; i: number; r: number }[] = [];
  for (let i = 0; i < 12; i++) {
    items.push({ v: i === 0 ? 12 : i, i, r: R_OUT }); // externo: 12, 1..11
    items.push({ v: i === 0 ? 0 : 12 + i, i, r: R_IN }); // interno: 00, 13..23
  }
  const sel = items.find((x) => x.v === value) ?? items[0];

  return (
    <View style={styles.dial}>
      <Hand angle={sel.i * 30} length={sel.r} />
      {items.map((x) => (
        <DialNumber key={`${x.r}-${x.v}`} text={pad(x.v)} i={x.i} r={x.r} selected={x.v === value} onPress={() => onPick(x.v)} small={x.r === R_IN} />
      ))}
    </View>
  );
}

function DialLabel({ text, i, r, selected }: { text: string; i: number; r: number; selected: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.num, place(i, r, CELL), selected && styles.numSelected]}>
      <Text style={[styles.numText, selected && styles.numTextSelected]}>{text}</Text>
    </View>
  );
}

/* ---------- Mostrador de minutos ---------- */

function MinuteDial({ value, onPick }: { value: number; onPick: (m: number) => void }) {
  const marks = Array.from({ length: 12 }, (_, i) => i * 5);

  // Converte o ponto tocado em minuto (0-59) pelo ângulo em relação ao centro.
  const pickAt = (x: number, y: number) => {
    const dx = x - C;
    const dy = y - C;
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0° no topo, sentido horário
    if (deg < 0) deg += 360;
    onPick(Math.round(deg / 6) % 60);
  };

  return (
    <View
      style={styles.dial}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => pickAt(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onResponderMove={(e) => pickAt(e.nativeEvent.locationX, e.nativeEvent.locationY)}
    >
      <Hand angle={value * 6} length={R_OUT} />
      {marks.map((mn, i) => (
        <DialLabel key={mn} text={pad(mn)} i={i} r={R_OUT} selected={mn === value} />
      ))}
    </View>
  );
}

/* ---------- Peças do mostrador ---------- */

function place(i: number, r: number, size: number) {
  const a = (i * 30 * Math.PI) / 180;
  return { left: C + r * Math.sin(a) - size / 2, top: C - r * Math.cos(a) - size / 2 };
}

function DialNumber({
  text,
  i,
  r,
  selected,
  onPress,
  small,
}: {
  text: string;
  i: number;
  r: number;
  selected: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.num, place(i, r, CELL), selected && styles.numSelected]}
    >
      <Text style={[styles.numText, small && styles.numTextSmall, selected && styles.numTextSelected]}>{text}</Text>
    </Pressable>
  );
}

function Dot({ i, r }: { i: number; r: number }) {
  return <View pointerEvents="none" style={[styles.dot, place(i, r, 4)]} />;
}

function Hand({ angle, length }: { angle: number; length: number }) {
  return (
    <>
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, top: 0, width: SIZE, height: SIZE, transform: [{ rotate: `${angle}deg` }] }}
      >
        <View style={{ position: "absolute", left: C - 1, top: C - length, width: 2, height: length, backgroundColor: colors.primary }} />
      </View>
      <View pointerEvents="none" style={styles.center} />
    </>
  );
}

const styles = StyleSheet.create({
  /* pílula (igual à do app nativo) */
  pill: {
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },

  /* modal */
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    ...shadow.md,
  },
  body: { flexGrow: 0, flexShrink: 1 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.foreground },

  /* cabeçalho HH : MM */
  header: { marginTop: 8, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  headerNum: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 40, color: colors.mutedForeground },
  headerActive: { color: colors.primary },
  headerColon: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 40, color: colors.mutedForeground },

  /* mostrador */
  dialWrap: { alignItems: "center" },
  dial: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.muted,
  },
  num: {
    position: "absolute",
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  numSelected: { backgroundColor: colors.primary },
  numText: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  numTextSmall: { fontSize: 12, color: colors.mutedForeground },
  numTextSelected: { color: colors.primaryForeground },
  dot: { position: "absolute", width: 4, height: 4, borderRadius: 2, backgroundColor: colors.mutedForeground, opacity: 0.5 },
  center: { position: "absolute", left: C - 4, top: C - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  /* rodapé */
  actions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  btn: {
    minHeight: 40,
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  btnOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  btnPrimary: { backgroundColor: colors.primary },
  btnText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, textAlign: "center" },
  btnTextOutline: { color: colors.foreground },
  btnTextPrimary: { color: colors.primaryForeground },
});