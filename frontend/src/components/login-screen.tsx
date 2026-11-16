// components/login-screen.tsx
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError } from "../lib/auth";
import { colors, fonts } from "../theme/colors";
import { useAuth } from "./auth-context";
import { AuthField } from "./auth-field";
import { Card, PrimaryButton, Screen } from "./ui";

type Props = {
  /** Chamado após login bem-sucedido (o token já foi salvo). */
  onSuccess?: () => void;
  onGoRegister: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TextInputRef = React.ComponentRef<typeof TextInput>

export function LoginScreen({ onSuccess, onGoRegister }: Props) {
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInputRef>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailError = touched && !EMAIL_RE.test(email.trim()) ? "Informe um e-mail válido." : null;
  const passwordError = touched && !password ? "Informe sua senha." : null;

  const submit = async () => {
    if (busy) return;
    setTouched(true);
    setError(null);
    if (!EMAIL_RE.test(email.trim()) || !password) return;

    setBusy(true);
    try {
      await signIn(email, password);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Entrar"
      subtitle="Acesse sua conta para continuar seu planejamento de estudos."
      footer={
        <>
          {error ? <Text style={styles.footerError}>{error}</Text> : null}
          <PrimaryButton disabled={busy} onPress={submit}>
            {busy ? "Entrando…" : "Entrar"}
          </PrimaryButton>
          <Pressable onPress={onGoRegister} hitSlop={8} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Ainda não tem conta? <Text style={styles.switchLink}>Criar conta</Text>
            </Text>
          </Pressable>
        </>
      }
    >
      <Card>
        <View style={styles.fields}>
          <AuthField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            error={emailError}
            placeholder="voce@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <AuthField
            ref={passwordRef}
            label="Senha"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            placeholder="Sua senha"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12 },
  footerError: {
    marginBottom: 8,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.destructive,
  },
  switchRow: { marginTop: 12, alignItems: "center" },
  switchText: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  switchLink: { fontFamily: fonts.bold, color: colors.primary },
});