// components/register-screen.tsx
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError } from "../lib/auth";
import { colors, fonts } from "../theme/colors";
import { useAuth } from "./auth-context";
import { AuthField } from "./auth-field";
import { Card, PrimaryButton, Screen } from "./ui";

type Props = {
  /** Chamado após o cadastro (o usuário já sai logado, com o token salvo). */
  onSuccess?: () => void;
  onGoLogin: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

type TextInputRef = React.ComponentRef<typeof TextInput>

export function RegisterScreen({ onSuccess, onGoLogin }: Props) {
  const { signUp } = useAuth();
  const emailRef = useRef<TextInputRef>(null);
  const passwordRef = useRef<TextInputRef>(null);
  const confirmRef = useRef<TextInputRef>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = {
    name: name.trim().length < 2 ? "Informe seu nome." : null,
    email: !EMAIL_RE.test(email.trim()) ? "Informe um e-mail válido." : null,
    password: password.length < MIN_PASSWORD ? `Use pelo menos ${MIN_PASSWORD} caracteres.` : null,
    confirm: confirm !== password ? "As senhas não coincidem." : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (key: keyof typeof errors) => (touched ? errors[key] : null);

  const submit = async () => {
    if (busy) return;
    setTouched(true);
    setError(null);
    if (hasErrors) return;

    setBusy(true);
    try {
      await signUp(name, email, password);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível criar a conta. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Criar conta"
      subtitle="Cadastre-se para salvar e acessar seu planejamento em qualquer lugar."
      onBack={onGoLogin}
      footer={
        <>
          {error ? <Text style={styles.footerError}>{error}</Text> : null}
          <PrimaryButton disabled={busy} onPress={submit}>
            {busy ? "Criando conta…" : "Criar conta"}
          </PrimaryButton>
          <Pressable onPress={onGoLogin} hitSlop={8} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Já tem conta? <Text style={styles.switchLink}>Entrar</Text>
            </Text>
          </Pressable>
        </>
      }
    >
      <Card>
        <View style={styles.fields}>
          <AuthField
            label="Nome"
            value={name}
            onChangeText={setName}
            error={show("name")}
            placeholder="Como devemos te chamar?"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <AuthField
            ref={emailRef}
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            error={show("email")}
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
            error={show("password")}
            placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <AuthField
            ref={confirmRef}
            label="Confirmar senha"
            value={confirm}
            onChangeText={setConfirm}
            error={show("confirm")}
            placeholder="Repita a senha"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
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