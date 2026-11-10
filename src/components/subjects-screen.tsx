// components/subjects-screen.tsx
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, PrimaryButton, Screen } from "./ui";
import { PRIORITY_LABEL, generate, replanFromToday, uid, type Priority, type State } from "../lib/rotina";
import { colors, fonts, radius } from "../theme/colors";

type Props = { state: State; update: (p: Partial<State>) => void };

const PRIO_COLOR: Record<Priority, string> = { alta: colors.high, media: colors.medium, baixa: colors.low };
const PRIORITIES: Priority[] = ["baixa", "media", "alta"];

export function SubjectsScreen({ state, update }: Props) {
  const [editing, setEditing] = useState<string | null>(null);

  const setSub = (id: string, p: Partial<State["subjects"][number]>) =>
    update({ subjects: state.subjects.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  const add = () => {
    const id = uid();
    update({ subjects: [...state.subjects, { id, name: "Nova disciplina", priority: "media" }] });
    setEditing(id);
  };

  const valid = state.subjects.filter((s) => s.name.trim());
  const preview = generate(state.days, valid, state.duration);

  const gen = () => {
    if (!preview.length) return;
    update({
      step: "routine",
      dismissed: [],
      ...(state.sessions.length || state.weeks ? replanFromToday(state, preview, new Date()) : { sessions: preview }),
    });
  };

  return (
    <Screen
      title="Disciplinas e prioridades"
      subtitle="Adicione as disciplinas e indique onde precisa dedicar mais esforço."
      onBack={() => update({ step: "availability" })}
      footer={
        <>
          {!preview.length ? (
            <Text style={styles.footerError}>
              Nenhuma sessão cabe na semana. Adicione uma disciplina ou aumente algum horário disponível.
            </Text>
          ) : null}
          <PrimaryButton disabled={!preview.length} onPress={gen}>
            {state.sessions.length ? "Gerar novo planejamento" : "Gerar planejamento"}
          </PrimaryButton>
        </>
      }
    >
      {state.subjects.map((s) => (
        <Card key={s.id}>
          <View style={styles.topRow}>
            {editing === s.id ? (
              <TextInput
                autoFocus
                value={s.name}
                onChangeText={(name) => setSub(s.id, { name })}
                onBlur={() => setEditing(null)}
                onSubmitEditing={() => setEditing(null)}
                returnKeyType="done"
                selectionColor={colors.primary}
                style={styles.input}
              />
            ) : (
              <Pressable onPress={() => setEditing(s.id)} style={styles.nameWrap}>
                <Text style={styles.name}>{s.name}</Text>
              </Pressable>
            )}
            <View style={styles.links}>
              <Pressable onPress={() => setEditing(s.id)} hitSlop={8}>
                <Text style={[styles.link, { color: colors.primary }]}>Editar</Text>
              </Pressable>
              <Pressable
                onPress={() => update({ subjects: state.subjects.filter((x) => x.id !== s.id) })}
                hitSlop={8}
              >
                <Text style={[styles.link, { color: colors.destructive }]}>Excluir</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.prioRow}>
            <Text style={styles.prioLabel}>Dificuldade</Text>
            <View style={styles.pills}>
              {PRIORITIES.map((p) => {
                const active = s.priority === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setSub(s.id, { priority: p })}
                    style={[styles.pill, { backgroundColor: active ? PRIO_COLOR[p] : colors.muted }]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: active ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {PRIORITY_LABEL[p]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>
      ))}

      <Pressable onPress={add} style={styles.addBtn}>
        <Text style={styles.addText}>+ Adicionar disciplina</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Duração das sessões</Text>
      <View style={styles.durations}>
        {[30, 45, 60].map((d) => {
          const active = state.duration === d;
          return (
            <Pressable
              key={d}
              onPress={() => update({ duration: d })}
              style={[
                styles.durBtn,
                active
                  ? { borderColor: colors.primary, backgroundColor: colors.primary }
                  : { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Text style={[styles.durText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                {d === 60 ? "1 hora" : `${d} min`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerError: {
    marginBottom: 8,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.destructive,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  nameWrap: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.foreground },
  input: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.foreground,
  },
  links: { flexDirection: "row", gap: 12 },
  link: { fontFamily: fonts.semibold, fontSize: 12 },
  prioRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prioLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  pills: { flexDirection: "row", gap: 4 },
  pill: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  addBtn: { borderRadius: radius.xl, backgroundColor: colors.primarySoft, padding: 16 },
  addText: { fontFamily: fonts.bold, fontSize: 14, color: colors.secondaryForeground },
  sectionTitle: { marginTop: 8, fontFamily: fonts.bold, fontSize: 14, color: colors.foreground },
  durations: { flexDirection: "row", gap: 8 },
  durBtn: { flex: 1, alignItems: "center", borderRadius: radius.lg, borderWidth: 1, paddingVertical: 8 },
  durText: { fontFamily: fonts.bold, fontSize: 12 },
});