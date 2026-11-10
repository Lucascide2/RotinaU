// components/primitives/badge.tsx
import { type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { colors, fonts, radius } from "../../theme/colors";
import { shadow } from "../ui";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const VARIANTS: Record<BadgeVariant, { bg: string; fg: string; border: string; shadow?: ViewStyle }> = {
  default: { bg: colors.primary, fg: colors.primaryForeground, border: "transparent", shadow: shadow.sm },
  secondary: { bg: colors.secondary, fg: colors.secondaryForeground, border: "transparent" },
  destructive: { bg: colors.destructive, fg: colors.destructiveForeground, border: "transparent", shadow: shadow.sm },
  outline: { bg: "transparent", fg: colors.foreground, border: colors.border },
};

/** Equivalente ao `badgeVariants()`. */
export function getBadgeStyles(variant: BadgeVariant = "default") {
  const v = VARIANTS[variant];
  return {
    container: { backgroundColor: v.bg, borderColor: v.border, ...v.shadow } as ViewStyle,
    text: { color: v.fg } as TextStyle,
  };
}

export function Badge({
  variant = "default",
  children,
  style,
  textStyle,
}: {
  variant?: BadgeVariant;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const v = getBadgeStyles(variant);
  return (
    <View style={[styles.base, v.container, style]}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={[styles.text, v.text, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start", // inline-flex
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  text: { fontFamily: fonts.semibold, fontSize: 12 },
});