// components/primitives/alert-dialog.tsx
// Substitui @radix-ui/react-alert-dialog usando o <Modal> nativo.
import { createContext, useContext, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { useControllableState } from "../../hooks/use-controllable-state";
import { colors, fonts, radius } from "../../theme/colors";
import { shadow } from "../ui";
import { Button } from "./button";

const DialogContext = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("Componentes de AlertDialog devem estar dentro de <AlertDialog>.");
  return ctx;
}

export function AlertDialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [current, setOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  return <DialogContext.Provider value={{ open: current, setOpen }}>{children}</DialogContext.Provider>;
}

/** Envolve qualquer elemento (ex.: um Button) e abre o diálogo ao toque. */
export function AlertDialogTrigger({
  children,
  style,
  disabled,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const { setOpen } = useDialog();
  return (
    <Pressable onPress={() => setOpen(true)} disabled={disabled} accessibilityRole="button" style={style}>
      {children}
    </Pressable>
  );
}

export function AlertDialogContent({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { open, setOpen } = useDialog();
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setOpen(false)} // botão voltar do Android
    >
      {/* Overlay: bg-black/80. Como em AlertDialog, tocar fora NÃO fecha. */}
      <View style={styles.overlay}>
        <View accessibilityRole="alert" style={[styles.content, style]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function AlertDialogHeader({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

/** flex-col-reverse: o botão principal (último no JSX) aparece primeiro no topo. */
export function AlertDialogFooter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

export function AlertDialogTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function AlertDialogDescription({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.description, style]}>{children}</Text>;
}

type ActionProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/** Executa o onPress e fecha o diálogo (comportamento do Radix). */
export function AlertDialogAction({ children, onPress, style, textStyle }: ActionProps) {
  const { setOpen } = useDialog();
  return (
    <Button
      style={style}
      textStyle={textStyle}
      onPress={() => {
        onPress?.();
        setOpen(false);
      }}
    >
      {children}
    </Button>
  );
}

export function AlertDialogCancel({ children, onPress, style, textStyle }: ActionProps) {
  const { setOpen } = useDialog();
  return (
    <Button
      variant="outline"
      style={style}
      textStyle={textStyle}
      onPress={() => {
        onPress?.();
        setOpen(false);
      }}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  content: {
    width: "100%",
    maxWidth: 512,
    gap: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 24,
    ...shadow.md,
  },
  header: { gap: 8, alignItems: "center" },
  footer: { flexDirection: "column-reverse", gap: 8 },
  title: { textAlign: "center", fontFamily: fonts.semibold, fontSize: 18, color: colors.foreground },
  description: {
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
});