// app/_layout.tsx
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/components/auth-context";
import { LoginScreen } from "@/components/login-screen";
import { RegisterScreen } from "@/components/register-screen";
import { installGlobalErrorHandlers, reportError } from "../lib/error-reporting";
import { colors, fonts, radius } from "../theme/colors";



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

<AuthProvider>
  <RootLayout />
</AuthProvider>

// Fica dentro do AuthProvider, senão useAuth() falha.
function RootNavigator() {
  const { ready } = useAuth();

  if (!ready) return null; // token salvo ainda sendo lido

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: PlusJakartaSans_400Regular,
    [fonts.medium]: PlusJakartaSans_500Medium,
    [fonts.semibold]: PlusJakartaSans_600SemiBold,
    [fonts.bold]: PlusJakartaSans_700Bold,
    [fonts.extrabold]: PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
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