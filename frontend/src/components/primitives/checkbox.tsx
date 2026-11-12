// components/primitives/checkbox.tsx
// Substitui @radix-ui/react-checkbox. Mesma API: checked / defaultChecked / onCheckedChange.
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Check, Minus } from "lucide-react-native";

import { useControllableState } from "../../hooks/use-controllable-state";
import { colors, radius } from "../../theme/colors";
import { shadow } from "../ui";

export type CheckedState = boolean | "indeterminate";

export function Checkbox({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  style,
  accessibilityLabel,
}: {
  checked?: CheckedState;
  defaultChecked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const [state, setState] = useControllableState<CheckedState>({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });

  const on = state === true || state === "indeterminate";

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: state === "indeterminate" ? "mixed" : state, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={10} // a caixa tem só 16px; amplia a área de toque
      onPress={() => setState(state === true ? false : true)}
      style={[styles.box, on && styles.boxOn, disabled && styles.disabled, style]}
    >
      {state === true ? <Check size={14} strokeWidth={3} color={colors.primaryForeground} /> : null}
      {state === "indeterminate" ? <Minus size={14} strokeWidth={3} color={colors.primaryForeground} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm, // neste tema rounded-sm = 10px, então a caixa de 16px fica quase circular
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "transparent",
    ...shadow.sm,
  },
  boxOn: { backgroundColor: colors.primary },
  disabled: { opacity: 0.5 },
});