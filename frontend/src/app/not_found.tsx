// app/not-found.tsx
import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "../theme/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Página não encontrada" }} />
      <View style={styles.center}>
        <View style={styles.box}>
          <Text style={styles.code}>404</Text>
          <Text style={styles.title}>Página não encontrada</Text>
          <Text style={styles.description}>
            A página que você procura não existe ou foi movida.
          </Text>

          <Link href="/" style={styles.link}>
            Ir para o início
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 16,
  },
  box: {
    maxWidth: 448,
    width: "100%",
    alignItems: "center",
  },
  code: {
    fontFamily: fonts.bold,
    fontSize: 72,
    color: colors.foreground,
  },
  title: {
    marginTop: 16,
    fontFamily: fonts.semibold,
    fontSize: 20,
    color: colors.foreground,
    textAlign: "center",
  },
  description: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  link: {
    marginTop: 24,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primaryForeground,
  },
});