// components/premium-crown.tsx
import { Crown, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getPremiumStatus, redeemPremiumCode } from "../../lib/premium-api";
import { colors, fonts, radius } from "../../theme/colors";
import { PrimaryButton, shadow } from "../ui";
import { useAuth } from "../auth-context"; // ajuste o caminho real

type Props = {
  /** Avisa o resto do app quando o status premium muda (ex.: liberar o chat). */
  onPremiumChange?: (premium: boolean) => void;
  /** Chamado se o servidor responder 401 (sessão inválida). */
  onUnauthorized?: () => void;
};

export function PremiumCrown({ onPremiumChange, onUnauthorized }: Props) {
  const { isAuthenticated } = useAuth();
  const [premium, setPremium] = useState(false);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true); // padrão: amarela

  const crownColor = online ? colors.warning : colors.mutedForeground;

  // Descobre se o usuário já é premium ao montar.
  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;

    const check = async () => {
      const s = await getPremiumStatus();
      if (!alive) return;
      setOnline(s.online);
      if (s.online) {
        setPremium(s.premium);
        onPremiumChange?.(s.premium);
      }
    };

    check();
    const t = setInterval(check, 30000); // reavalia a cada 30 s
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    setOpen(false);
    setCode("");
    setError(null);
  }, []);

  const submit = async () => {
    if (loading) return;
    if (!code.trim()) {
      setError("Informe o código.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await redeemPremiumCode(code);
    setLoading(false);

    if (result.ok) {
      setPremium(true);
      onPremiumChange?.(true);
      close();
      return;
    }

    setError(result.message);
    if (result.reason === "unauthorized") onUnauthorized?.();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel={
          !online ? "Premium indisponível: sem conexão" : premium ? "Premium ativo" : "Ativar versão premium"
        }
        style={[styles.btn, online && styles.btnOnline]}
      >
        <Crown size={18} color={crownColor} fill={premium ? crownColor : "none"} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fechar">
            {/* Pressable interno evita fechar ao tocar dentro do cartão */}
            <Pressable style={styles.card} onPress={() => {}}>
              <View style={styles.head}>
                <View style={styles.titleRow}>
                  <Crown size={18} color={colors.warning} />
                  <Text style={styles.title}>Versão premium</Text>
                </View>
                <Pressable onPress={close} hitSlop={8} accessibilityLabel="Fechar">
                  <X size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {premium ? (
                <Text style={styles.text}>Seu premium já está ativo. Aproveite a geração de sessões de estudo com a LLM! 🎉</Text>
              ) : (
                <>
                  <Text style={styles.text}>Digite o seu código único para liberar o uso de uma LLM na geração de sessões de estudo com a versão premium.</Text>

                  <TextInput
                    value={code}
                    onChangeText={(t) => {
                      setCode(t);
                      if (error) setError(null);
                    }}
                    placeholder="XXXX-XXXX-XXXX"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="off"
                    maxLength={14}
                    editable={!loading}
                    onSubmitEditing={submit}
                    returnKeyType="done"
                    style={[styles.input, error && styles.inputError]}
                  />

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <PrimaryButton onPress={submit}>{loading ? "Verificando..." : "Ativar premium"}</PrimaryButton>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  btn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  btnActive: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  btnOnline: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    ...shadow.md,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.foreground },
  text: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.mutedForeground },

  input: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: 1.5,
    textAlign: "center",
    color: colors.foreground,
  },
  inputError: { borderColor: colors.warning },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.warning },
});