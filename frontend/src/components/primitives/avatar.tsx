// components/primitives/avatar.tsx
// Substitui @radix-ui/react-avatar. O fallback aparece enquanto a imagem não carregou
// ou se ela falhar, como no Radix.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { colors, fonts, radius } from "../../theme/colors";

type Status = "idle" | "loaded" | "error";

const AvatarContext = createContext<{ status: Status; setStatus: (s: Status) => void } | null>(null);

export function Avatar({
  size = 40,
  children,
  style,
}: {
  /** Equivale a h-10 w-10 (40px). */
  size?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [status, setStatus] = useState<Status>("idle");
  return (
    <AvatarContext.Provider value={{ status, setStatus }}>
      <View style={[styles.root, { width: size, height: size }, style]}>{children}</View>
    </AvatarContext.Provider>
  );
}

type ImageProps = {
  /** Atalho para { uri }. Use `source` para imagens locais (require). */
  src?: string;
  source?: ImageSourcePropType;
  accessibilityLabel?: string;
};

export function AvatarImage({ src, source, accessibilityLabel }: ImageProps) {
  const ctx = useContext(AvatarContext);
  const resolved: ImageSourcePropType | undefined = source ?? (src ? { uri: src } : undefined);

  // Se a origem mudar, volta ao estado inicial para o fallback reaparecer.
  useEffect(() => {
    ctx?.setStatus("idle");
  }, [src, source]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!resolved || ctx?.status === "error") return null;

  return (
    <Image
      source={resolved}
      accessibilityLabel={accessibilityLabel}
      onLoad={() => ctx?.setStatus("loaded")}
      onError={() => ctx?.setStatus("error")}
      resizeMode="cover"
      style={styles.image}
    />
  );
}

export function AvatarFallback({
  children,
  style,
  textStyle,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const ctx = useContext(AvatarContext);
  if (ctx?.status === "loaded") return null;

  return (
    <View style={[styles.fallback, style]}>
      {typeof children === "string" ? <Text style={[styles.fallbackText, textStyle]}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden", borderRadius: radius.full },
  image: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  fallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  fallbackText: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
});