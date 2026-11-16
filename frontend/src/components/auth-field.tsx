// components/auth-field.tsx
import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, fonts, radius } from "../theme/colors";

type Props = TextInputProps & {
  label: string;
  error?: string | null;
};

type TextInputRef = React.ComponentRef<typeof TextInput>

export const AuthField = forwardRef<TextInputRef, Props>(function AuthField(
  { label, error, secureTextEntry, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isPassword = !!secureTextEntry;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.box,
          { borderColor: error ? colors.destructive : focused ? colors.primary : colors.input },
        ]}
      >
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={isPassword && hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.primary}
          style={[styles.input, style]}
        />
        {isPassword ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <Text style={styles.toggle}>{hidden ? "Mostrar" : "Ocultar"}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.mutedForeground },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.foreground,
  },
  toggle: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.destructive },
});