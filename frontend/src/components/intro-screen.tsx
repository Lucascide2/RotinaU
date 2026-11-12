// components/intro-screen.tsx
import { StyleSheet, Text, View } from "react-native";

import { Card, GradientBox, Page, PrimaryButton } from "./ui";
import { colors, fonts, radius } from "../theme/colors";

const ITEMS: [string, string][] = [
  ["Disponibilidade", "Informe quando você realmente pode estudar."],
  ["Prioridades", "Marque a dificuldade de cada disciplina."],
  ["Rotina sugerida", "Receba uma divisão semanal editável."],
];

export function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <Page footer={<PrimaryButton onPress={onStart}>Começar planejamento</PrimaryButton>}>
      <GradientBox style={styles.hero}>
        <Text style={styles.heroTitle}>RotinaU</Text>
        <Text style={styles.heroSub}>Planejador de estudos</Text>
      </GradientBox>

      <Text style={styles.title}>Organize seu tempo de estudo</Text>
      <Text style={styles.description}>
        Monte uma rotina semanal de acordo com a sua disponibilidade real e com as disciplinas que exigem mais atenção.
      </Text>

      <View style={styles.list}>
        {ITEMS.map(([t, d]) => (
          <Card key={t} style={styles.item}>
            <View style={styles.bullet}>
              <View style={styles.bulletDot} />
            </View>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>{t}</Text>
              <Text style={styles.itemDesc}>{d}</Text>
            </View>
          </Card>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingVertical: 16 },
  heroTitle: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, color: colors.primaryForeground },
  heroSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.primaryForeground, opacity: 0.85 },
  title: {
    marginTop: 32,
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: colors.foreground,
  },
  description: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  list: { marginTop: 24, gap: 12 },
  item: { flexDirection: "row", gap: 12 },
  bullet: {
    marginTop: 2,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  bulletDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.primary },
  itemText: { flex: 1 },
  itemTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.foreground },
  itemDesc: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
});