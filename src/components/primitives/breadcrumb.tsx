// components/primitives/breadcrumb.tsx
// Substitui nav/ol/li/a por View/Pressable. Links navegam com o Expo Router.
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useRouter, type Href } from "expo-router";
import { ChevronRight, MoreHorizontal } from "lucide-react-native";

import { colors, fonts } from "../../theme/colors";

export function Breadcrumb({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityLabel="breadcrumb" style={style}>
      {children}
    </View>
  );
}

export function BreadcrumbList({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.list, style]}>{children}</View>;
}

export function BreadcrumbItem({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.item, style]}>{children}</View>;
}

/** Use `href` (rota do Expo Router) ou `onPress`. O `asChild` do Radix não existe aqui. */
export function BreadcrumbLink({
  href,
  onPress,
  children,
  style,
  textStyle,
}: {
  href?: Href;
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress ?? (href ? () => router.push(href) : undefined)}
      style={style}
    >
      {({ pressed }) =>
        typeof children === "string" ? (
          <Text style={[styles.text, pressed && styles.textPressed, textStyle]}>{children}</Text>
        ) : (
          children
        )
      }
    </Pressable>
  );
}

/** Página atual (não clicável). */
export function BreadcrumbPage({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="link" accessibilityState={{ disabled: true, selected: true }} style={[styles.page, style]}>
      {children}
    </Text>
  );
}

export function BreadcrumbSeparator({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
      {children ?? <ChevronRight size={14} color={colors.mutedForeground} />}
    </View>
  );
}

export function BreadcrumbEllipsis({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityLabel="Mais" style={[styles.ellipsis, style]}>
      <MoreHorizontal size={16} color={colors.mutedForeground} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { fontFamily: fonts.regular, fontSize: 14, color: colors.mutedForeground },
  textPressed: { color: colors.foreground },
  page: { fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },
  ellipsis: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});