// components/primitives/dialog.tsx
// Substitui @radix-ui/react-dialog usando o <Modal> nativo.
// Overlay e Portal são embutidos no DialogContent (o Modal já é uma camada acima de tudo).
import { createContext, useContext, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { X } from "lucide-react-native";

import { useControllableState } from "../../hooks/use-controllable-state";
import { colors, fonts, radius } from "../../theme/colors";
import { shadow } from "../ui";

const DialogContext = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("Componentes de Dialog devem estar dentro de <Dialog>.");
  return ctx;
}

export function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  const [current, setOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  return <DialogContext.Provider value={{ open: current, setOpen }}>{children}</DialogContext.Provider>;
}

/** Envolve qualquer elemento (ex.: um Button) e abre o diálogo ao toque. */
export function DialogTrigger({
  children,
  style,
  disabled,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const { setOpen } = useDialog();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setOpen(true)} style={style}>
      {children}
    </Pressable>
  );
}

/** Só repassa os filhos: no RN o Modal já cumpre o papel do Portal. */
export function DialogPortal({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/** Fecha o diálogo ao toque (ex.: botão "Cancelar"). */
export function DialogClose({
  children,
  style,
  onPress,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { setOpen } = useDialog();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        onPress?.();
        setOpen(false);
      }}
      style={style}
    >
      {children}
    </Pressable>
  );
}

export function DialogContent({
  children,
  style,
  showClose = true,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Botão X no canto, como no shadcn. */
  showClose?: boolean;
}) {
  const { open, setOpen } = useDialog();
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setOpen(false)} // botão voltar do Android
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Overlay: toque fora fecha, como no Radix Dialog */}
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} accessibilityLabel="Fechar">
          {/* Pressable interno impede que tocar dentro do cartão feche o diálogo */}
          <Pressable style={[styles.content, style]} onPress={() => {}}>
            {children}
            {showClose ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                hitSlop={8}
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.close, pressed && { opacity: 1 }]}
              >
                <X size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function DialogHeader({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

/** flex-col-reverse: o último filho (botão principal) aparece primeiro, no topo. */
export function DialogFooter({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

export function DialogTitle({ children, style }: { children?: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="header" style={[styles.title, style]}>
      {children}
    </Text>
  );
}

export function DialogDescription({ children, style }: { children?: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.description, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  close: { position: "absolute", right: 16, top: 16, borderRadius: radius.sm, opacity: 0.7 },
  header: { gap: 6, alignItems: "center" },
  footer: { flexDirection: "column-reverse", gap: 8 },
  title: {
    textAlign: "center",
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.45,
    color: colors.foreground,
  },
  description: {
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
});