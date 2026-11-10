// components/primitives/card.tsx
import { type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { colors, fonts, radius } from "../../theme/colors";
import { shadow } from "../ui";

type BoxProps = { children?: ReactNode; style?: StyleProp<ViewStyle> };
type TextProps = { children?: ReactNode; style?: StyleProp<TextStyle> };

export function Card({ children, style }: BoxProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardHeader({ children, style }: BoxProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function CardTitle({ children, style }: TextProps) {
  return (
    <Text accessibilityRole="header" style={[styles.title, style]}>
      {children}
    </Text>
  );
}

export function CardDescription({ children, style }: TextProps) {
  return <Text style={[styles.description, style]}>{children}</Text>;
}

export function CardContent({ children, style }: BoxProps) {
  return <View style={[styles.content, style]}>{children}</View>;
}

export function CardFooter({ children, style }: BoxProps) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadow.sm,
  },
  header: { gap: 6, padding: 24 },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.4,
    color: colors.cardForeground,
  },
  description: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  content: { padding: 24, paddingTop: 0 },
  footer: { flexDirection: "row", alignItems: "center", padding: 24, paddingTop: 0 },
});