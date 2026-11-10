// components/primitives/aspect-ratio.tsx
// RN tem `aspectRatio` nativo no estilo, então o hack de padding do Radix não é necessário.
import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export function AspectRatio({
  ratio = 1,
  children,
  style,
}: {
  ratio?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: "100%", aspectRatio: ratio }, style]}>
      {/* Como no Radix, o conteúdo preenche toda a área. */}
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </View>
  );
}