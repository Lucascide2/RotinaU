// components/primitives/button.tsx
// Substitui button.tsx do shadcn (cva + Slot). `hover:` vira o estado `pressed`.
import { Children, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { colors, fonts, radius } from "../../theme/colors";
import { shadow } from "../ui";

export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

type VariantSpec = {
  bg: string;
  fg: string;
  border?: string;
  shadow?: ViewStyle;
  pressedBg?: string;
  pressedFg?: string;
  pressedOpacity: number;
  underlineOnPress?: boolean;
};

const VARIANTS: Record<ButtonVariant, VariantSpec> = {
  default: { bg: colors.primary, fg: colors.primaryForeground, shadow: shadow.sm, pressedOpacity: 0.9 },
  destructive: { bg: colors.destructive, fg: colors.destructiveForeground, shadow: shadow.sm, pressedOpacity: 0.9 },
  outline: {
    bg: colors.background,
    fg: colors.foreground,
    border: colors.input,
    shadow: shadow.sm,
    pressedBg: colors.accent,
    pressedFg: colors.accentForeground,
    pressedOpacity: 1,
  },
  secondary: { bg: colors.secondary, fg: colors.secondaryForeground, shadow: shadow.sm, pressedOpacity: 0.8 },
  ghost: {
    bg: "transparent",
    fg: colors.foreground,
    pressedBg: colors.accent,
    pressedFg: colors.accentForeground,
    pressedOpacity: 1,
  },
  link: { bg: "transparent", fg: colors.primary, pressedOpacity: 0.8, underlineOnPress: true },
};

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; width?: number; fontSize: number }> = {
  default: { height: 36, paddingHorizontal: 16, fontSize: 14 },
  sm: { height: 32, paddingHorizontal: 12, fontSize: 12 },
  lg: { height: 40, paddingHorizontal: 32, fontSize: 14 },
  icon: { height: 36, width: 36, paddingHorizontal: 0, fontSize: 14 },
};

/** Equivalente ao `buttonVariants()`: devolve os estilos de container e de texto. */
export function getButtonStyles(variant: ButtonVariant, size: ButtonSize, pressed = false) {
  const v = VARIANTS[variant];
  const s = SIZES[size];

  const container: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.md,
    height: s.height,
    paddingHorizontal: s.paddingHorizontal,
    ...(s.width ? { width: s.width } : null),
    backgroundColor: pressed && v.pressedBg ? v.pressedBg : v.bg,
    opacity: pressed ? v.pressedOpacity : 1,
    ...(v.border ? { borderWidth: 1, borderColor: v.border } : null),
    ...v.shadow,
  };

  const text: TextStyle = {
    fontFamily: fonts.medium,
    fontSize: s.fontSize,
    color: pressed && v.pressedFg ? v.pressedFg : v.fg,
    textDecorationLine: pressed && v.underlineOnPress ? "underline" : "none",
  };

  return { container, text };
}

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Texto e/ou ícones. Strings viram <Text> com a cor correta da variante. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Button({
  variant = "default",
  size = "default",
  children,
  style,
  textStyle,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [getButtonStyles(variant, size, pressed).container, disabled && styles.disabled, style]}
    >
      {({ pressed }) => {
        const { text } = getButtonStyles(variant, size, pressed);
        return (
          <>
            {Children.map(children, (child) =>
              typeof child === "string" || typeof child === "number" ? (
                <Text style={[text, textStyle]}>{child}</Text>
              ) : (
                child
              ),
            )}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.5 },
});