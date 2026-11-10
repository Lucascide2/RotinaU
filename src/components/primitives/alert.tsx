// components/primitives/alert.tsx
// No web, o <svg> filho era posicionado por seletores CSS ([&>svg]:absolute...).
// No RN, o ícone vira a prop `icon`.
import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { colors, fonts, radius } from "../../theme/colors";
import { withAlpha } from "../../theme/alpha";

type Variant = "default" | "destructive";

const VariantContext = createContext<Variant>("default");

export function Alert({
  variant = "default",
  icon,
  children,
  style,
}: {
  variant?: Variant;
  /** Ex.: <AlertCircle size={16} color={colors.destructive} /> */
  icon?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <VariantContext.Provider value={variant}>
      <View
        accessibilityRole="alert"
        style={[styles.base, variant === "destructive" ? styles.destructive : styles.default, style]}
      >
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <View style={icon ? styles.withIcon : undefined}>{children}</View>
      </View>
    </VariantContext.Provider>
  );
}

export function AlertTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const variant = useContext(VariantContext);
  return (
    <Text style={[styles.title, { color: variant === "destructive" ? colors.destructive : colors.foreground }, style]}>
      {children}
    </Text>
  );
}

export function AlertDescription({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const variant = useContext(VariantContext);
  return (
    <Text
      style={[styles.description, { color: variant === "destructive" ? colors.destructive : colors.foreground }, style]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  default: { borderColor: colors.border, backgroundColor: colors.background },
  destructive: { borderColor: withAlpha(colors.destructive, 0.5), backgroundColor: colors.background },
  icon: { position: "absolute", left: 16, top: 16 },
  withIcon: { paddingLeft: 28 },
  title: { marginBottom: 4, fontFamily: fonts.medium, fontSize: 14, lineHeight: 14, letterSpacing: -0.35 },
  description: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
});