// components/primitives/collapsible.tsx
// Substitui @radix-ui/react-collapsible. Mesma API: open / defaultOpen / onOpenChange / disabled.
import { createContext, useContext, type ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { useControllableState } from "../../hooks/use-controllable-state";

type Ctx = { open: boolean; setOpen: (open: boolean) => void; disabled: boolean };
const CollapsibleContext = createContext<Ctx | null>(null);

function useCollapsible() {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error("Componentes de Collapsible devem estar dentro de <Collapsible>.");
  return ctx;
}

export function Collapsible({
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  children,
  style,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [current, setOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  return (
    <CollapsibleContext.Provider value={{ open: current, setOpen, disabled }}>
      <View style={style}>{children}</View>
    </CollapsibleContext.Provider>
  );
}

/** Envolve o conteúdo do gatilho (texto, botão, ícone...) e alterna ao toque. */
export function CollapsibleTrigger({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { open, setOpen, disabled } = useCollapsible();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open, disabled }}
      disabled={disabled}
      onPress={() => setOpen(!open)}
      style={style}
    >
      {children}
    </Pressable>
  );
}

export function CollapsibleContent({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { open } = useCollapsible();
  if (!open) return null;
  return <View style={style}>{children}</View>;
}