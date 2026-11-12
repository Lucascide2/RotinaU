// components/primitives/accordion.tsx
// Substitui @radix-ui/react-accordion. Mesma API: type, collapsible, value, defaultValue, onValueChange.
import { createContext, useContext, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { ChevronDown } from "lucide-react-native";

import { useControllableState } from "../../hooks/use-controllable-state";
import { colors, fonts } from "../../theme/colors";

type Single = {
  type: "single";
  collapsible?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};
type Multiple = {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};
type RootProps = (Single | Multiple) & { children: ReactNode; style?: StyleProp<ViewStyle> };

const RootContext = createContext<{ isOpen: (v: string) => boolean; toggle: (v: string) => void } | null>(null);
const ItemContext = createContext<{ value: string; open: boolean } | null>(null);

const toArray = (v?: string | string[]) => (v === undefined ? undefined : Array.isArray(v) ? v : v ? [v] : []);

export function Accordion(props: RootProps) {
  const { type, children, style } = props;
  const collapsible = props.type === "single" ? !!props.collapsible : true;

  const [open, setOpen] = useControllableState<string[]>({
    value: toArray(props.value),
    defaultValue: toArray(props.defaultValue) ?? [],
    onChange: (arr) => {
      if (props.type === "single") props.onValueChange?.(arr[0] ?? "");
      else props.onValueChange?.(arr);
    },
  });

  const toggle = (v: string) => {
    const isOpen = open.includes(v);
    if (type === "multiple") setOpen(isOpen ? open.filter((x) => x !== v) : [...open, v]);
    else setOpen(isOpen ? (collapsible ? [] : open) : [v]);
  };

  return (
    <RootContext.Provider value={{ isOpen: (v) => open.includes(v), toggle }}>
      <View style={style}>{children}</View>
    </RootContext.Provider>
  );
}

export function AccordionItem({
  value,
  children,
  style,
}: {
  value: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const root = useContext(RootContext);
  const open = root?.isOpen(value) ?? false;
  return (
    <ItemContext.Provider value={{ value, open }}>
      <View style={[styles.item, style]}>{children}</View>
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({
  children,
  style,
  textStyle,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const root = useContext(RootContext);
  const item = useContext(ItemContext);
  if (!root || !item) return null;

  return (
    <Pressable
      onPress={() => root.toggle(item.value)}
      accessibilityRole="button"
      accessibilityState={{ expanded: item.open }}
      style={({ pressed }) => [styles.trigger, pressed && styles.pressed, style]}
    >
      {typeof children === "string" ? (
        <Text style={[styles.triggerText, textStyle]}>{children}</Text>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
      <ChevronDown
        size={16}
        color={colors.mutedForeground}
        style={item.open ? styles.chevronOpen : undefined}
      />
    </Pressable>
  );
}

export function AccordionContent({
  children,
  style,
  textStyle,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const item = useContext(ItemContext);
  if (!item?.open) return null;
  return (
    <View style={[styles.content, style]}>
      {typeof children === "string" ? <Text style={[styles.contentText, textStyle]}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  item: { borderBottomWidth: 1, borderBottomColor: colors.border },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 16,
  },
  pressed: { opacity: 0.7 },
  triggerText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  content: { paddingBottom: 16 },
  contentText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.foreground },
});