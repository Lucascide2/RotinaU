// app/_layout.tsx
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { colors, fonts, radius } from "../theme/colors";
import { reportError, installGlobalErrorHandlers } from "../lib/error-reporting";



SplashScreen.preventAutoHideAsync();

SplashScreen.preventAutoHideAsync();
installGlobalErrorHandlers();

/**
 * Error boundary do Expo Router.
 * Substitui o `errorComponent` do TanStack Router.
 * `retry` equivale ao `reset` + `router.invalidate()`.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    reportError(error, { boundary: "expo_root_error_boundary" });
  }, [error]);

  return (
    <View style={styles.center}>
      <View style={styles.box}>
        <Text style={styles.title}>Esta tela não carregou</Text>
        <Text style={styles.description}>
          Algo deu errado do nosso lado. Você pode tentar novamente ou voltar para o início.
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={retry}
            style={({ pressed }) => [styles.buttonPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.buttonPrimaryText}>Tentar novamente</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace("/")}
            style={({ pressed }) => [styles.buttonOutline, pressed && styles.pressed]}
          >
            <Text style={styles.buttonOutlineText}>Ir para o início</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function RootLayout() {
  // Equivalente ao `new QueryClient()` do router.tsx.
  // useState garante uma única instância durante o ciclo de vida do app.
  const [queryClient] = useState(() => new QueryClient());

  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: PlusJakartaSans_400Regular,
    [fonts.medium]: PlusJakartaSans_500Medium,
    [fonts.semibold]: PlusJakartaSans_600SemiBold,
    [fonts.bold]: PlusJakartaSans_700Bold,
    [fonts.extrabold]: PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        {/* Equivalente ao <Outlet />: as rotas filhas renderizam aqui. */}
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
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
  title: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    letterSpacing: -0.2,
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
  actions: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  buttonPrimary: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonPrimaryText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primaryForeground,
  },
  buttonOutline: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonOutlineText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.foreground,
  },
  pressed: {
    opacity: 0.85,
  },
});