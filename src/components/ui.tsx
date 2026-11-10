// components/ui.tsx
import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fonts, gradients, radius } from "../theme/colors";

/** shadow-sm / shadow-md do Tailwind (iOS usa shadow*, Android usa elevation). */
export const shadow = {
  sm: Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    default: { elevation: 1 },
  }),
  md: Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
    default: { elevation: 3 },
  }),
};

/** Equivalente ao <main>/container: ocupa a tela inteira respeitando notch e barra inferior. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.shell} edges={["top", "bottom"]}>
      <View style={styles.column}>{children}</View>
    </SafeAreaView>
  );
}

/** Área rolável + rodapé fixo (substitui `sticky bottom-0`). */
export function Page({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

export function Screen({
  title,
  subtitle,
  children,
  footer,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <Page footer={footer}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
          <Text style={styles.backText}>← Voltar</Text>
        </Pressable>
      ) : null}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {action}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </Page>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Equivalente ao `bg-gradient-primary`. */
export function GradientBox({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={gradients.primary.colors}
      start={gradients.primary.start}
      end={gradients.primary.end}
      style={[{ borderRadius: radius["2xl"] }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function PrimaryButton({
  children,
  onPress,
  disabled,
}: {
  children: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primaryBtn, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Text style={styles.primaryBtnText}>{children}</Text>
    </Pressable>
  );
}

/** Botão pequeno (Aceitar / Ignorar / Concluir...). */
export function SmallButton({
  label,
  onPress,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline";
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.smallBtn, primary ? styles.smallPrimary : styles.smallOutline, pressed && styles.pressed]}
    >
      <Text style={[styles.smallText, { color: primary ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ bg, color, children }: { bg: string; color: string; children: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

export function Legend({ color, label, ring }: { color?: string; label: string; ring?: boolean }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.dot, ring ? styles.dotRing : { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shell: { flex: 1, backgroundColor: colors.background },
  column: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center" },
  pageContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },

  back: { alignSelf: "flex-start", marginBottom: 12 },
  backText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: colors.foreground,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  body: { marginTop: 20, gap: 12 },

  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    ...shadow.sm,
  },

  primaryBtn: {
    width: "100%",
    alignItems: "center",
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    ...shadow.md,
  },
  primaryBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryForeground },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.9 },

  smallBtn: { borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 6 },
  smallPrimary: { backgroundColor: colors.primary },
  smallOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  smallText: { fontFamily: fonts.bold, fontSize: 12 },

  badge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10 },

  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { fontFamily: fonts.regular, fontSize: 11, color: colors.mutedForeground },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  dotRing: { borderWidth: 2, borderColor: colors.primary },
});