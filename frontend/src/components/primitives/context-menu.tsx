import * as React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import { Check, ChevronDown, ChevronRight } from "lucide-react-native";
import { cssInterop } from "nativewind";

import { cn } from "@/lib/utils";

// Permite usar `className="text-..."` para colorir os ícones do lucide
[Check, ChevronDown, ChevronRight].forEach((Icon) =>
  cssInterop(Icon, {
    className: { target: "style", nativeStyleToProp: { color: true } },
  }),
);

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

type ViewRef = React.ComponentRef<typeof View>;
type TextRef = React.ComponentRef<typeof Text>;
type SelectEvent = { defaultPrevented: boolean; preventDefault: () => void };


function createSelectEvent(): SelectEvent {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

// No RN, strings soltas dentro de <View> quebram: embrulha em <Text>
function renderChildren(children: React.ReactNode, textClassName: string) {
  return React.Children.map(children, (child) =>
    typeof child === "string" || typeof child === "number" ? (
      <Text className={textClassName}>{child}</Text>
    ) : (
      child
    ),
  );
}

const ITEM_TEXT = "text-sm text-popover-foreground";

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

type ContextMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  position: { x: number; y: number };
  openAt: (x: number, y: number) => void;
};

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(null);

function useContextMenu() {
  const ctx = React.useContext(ContextMenuContext);
  if (!ctx) throw new Error("ContextMenu components must be used within <ContextMenu>");
  return ctx;
}

interface ContextMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const ContextMenu = ({ open: openProp, onOpenChange, children }: ContextMenuProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const openAt = React.useCallback(
    (x: number, y: number) => {
      setPosition({ x, y });
      setOpen(true);
    },
    [setOpen],
  );

  const value = React.useMemo(
    () => ({ open, setOpen, position, openAt }),
    [open, setOpen, position, openAt],
  );

  return <ContextMenuContext.Provider value={value}>{children}</ContextMenuContext.Provider>;
};

/* -------------------------------------------------------------------------- */
/*                                   Trigger                                  */
/* -------------------------------------------------------------------------- */

// Equivalente ao clique direito da web: pressionar e segurar
const ContextMenuTrigger = React.forwardRef<ViewRef, PressableProps>(
  ({ onLongPress, ...props }, ref) => {
    const { openAt } = useContextMenu();
    return (
      <Pressable
        ref={ref}
        delayLongPress={350}
        onLongPress={(e: GestureResponderEvent) => {
          onLongPress?.(e);
          openAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
        }}
        {...props}
      />
    );
  },
);
ContextMenuTrigger.displayName = "ContextMenuTrigger";

/* -------------------------------------------------------------------------- */
/*                           Group / Portal (simples)                         */
/* -------------------------------------------------------------------------- */

const ContextMenuGroup = (props: ViewProps) => <View {...props} />;

// O <Modal> já funciona como portal no RN
const ContextMenuPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

const ContextMenuContent = React.forwardRef<ViewRef, ViewProps>(
  ({ className, style, children, ...props }, ref) => {
    const { open, setOpen, position } = useContextMenu();
    const { width: screenW, height: screenH } = useWindowDimensions();
    const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

    React.useEffect(() => {
      if (!open) setSize(null);
    }, [open]);

    const margin = 8;
    const left = size
      ? Math.max(margin, Math.min(position.x, screenW - size.w - margin))
      : position.x;
    const top = size
      ? Math.max(margin, Math.min(position.y, screenH - size.h - margin))
      : position.y;

    return (
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View
          ref={ref}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setSize((prev) =>
              prev && prev.w === width && prev.h === height ? prev : { w: width, h: height },
            );
          }}
          className={cn(
            "min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md",
            className,
          )}
          style={[
            { position: "absolute", left, top, maxHeight: screenH - margin * 2, opacity: size ? 1 : 0 },
            style,
          ]}
          {...props}
        >
          <ScrollView bounces={false}>{children}</ScrollView>
        </View>
      </Modal>
    );
  },
);
ContextMenuContent.displayName = "ContextMenuContent";

/* -------------------------------------------------------------------------- */
/*                                    Items                                   */
/* -------------------------------------------------------------------------- */

interface ItemBaseProps extends Omit<PressableProps, "children" | "onPress"> {
  className?: string;
  textClassName?: string;
  children?: React.ReactNode;
  /** Chame `event.preventDefault()` para manter o menu aberto. */
  onSelect?: (event: SelectEvent) => void;
}

function useSelect() {
  const { setOpen } = useContextMenu();
  return React.useCallback(
    (cb?: (event: SelectEvent) => void) => {
      const event = createSelectEvent();
      cb?.(event);
      if (!event.defaultPrevented) setOpen(false);
    },
    [setOpen],
  );
}

const ContextMenuItem = React.forwardRef<ViewRef, ItemBaseProps & { inset?: boolean }>(
  ({ className, textClassName, inset, disabled, onSelect, children, ...props }, ref) => {
    const select = useSelect();
    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        onPress={() => select(onSelect)}
        className={cn(
          "relative flex-row items-center rounded-sm px-2 py-1.5 active:bg-accent",
          inset && "pl-8",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        {renderChildren(children, cn(ITEM_TEXT, textClassName))}
      </Pressable>
    );
  },
);
ContextMenuItem.displayName = "ContextMenuItem";

const ContextMenuCheckboxItem = React.forwardRef<
  ViewRef,
  ItemBaseProps & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }
>(
  (
    { className, textClassName, checked, onCheckedChange, disabled, onSelect, children, ...props },
    ref,
  ) => {
    const select = useSelect();
    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        onPress={() =>
          select((e) => {
            onCheckedChange?.(!checked);
            onSelect?.(e);
          })
        }
        className={cn(
          "relative flex-row items-center rounded-sm py-1.5 pl-8 pr-2 active:bg-accent",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        <View className="absolute left-2 h-3.5 w-3.5 items-center justify-center">
          {checked && <Check size={16} className="text-popover-foreground" />}
        </View>
        {renderChildren(children, cn(ITEM_TEXT, textClassName))}
      </Pressable>
    );
  },
);
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem";

/* ------------------------------- Radio group ------------------------------ */

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

const ContextMenuRadioGroup = ({
  value,
  onValueChange,
  ...props
}: ViewProps & { value?: string; onValueChange?: (value: string) => void }) => (
  <RadioGroupContext.Provider value={{ value, onValueChange }}>
    <View {...props} />
  </RadioGroupContext.Provider>
);

const ContextMenuRadioItem = React.forwardRef<ViewRef, ItemBaseProps & { value: string }>(
  ({ className, textClassName, value, disabled, onSelect, children, ...props }, ref) => {
    const select = useSelect();
    const group = React.useContext(RadioGroupContext);
    const checked = group.value === value;
    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        onPress={() =>
          select((e) => {
            group.onValueChange?.(value);
            onSelect?.(e);
          })
        }
        className={cn(
          "relative flex-row items-center rounded-sm py-1.5 pl-8 pr-2 active:bg-accent",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        <View className="absolute left-2 h-3.5 w-3.5 items-center justify-center">
          {checked && <View className="h-2 w-2 rounded-full bg-popover-foreground" />}
        </View>
        {renderChildren(children, cn(ITEM_TEXT, textClassName))}
      </Pressable>
    );
  },
);
ContextMenuRadioItem.displayName = "ContextMenuRadioItem";

/* -------------------------------------------------------------------------- */
/*                         Label / Separator / Shortcut                       */
/* -------------------------------------------------------------------------- */

const ContextMenuLabel = React.forwardRef<TextRef, TextProps & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn("px-2 py-1.5 text-sm font-semibold text-foreground", inset && "pl-8", className)}
      {...props}
    />
  ),
);
ContextMenuLabel.displayName = "ContextMenuLabel";

const ContextMenuSeparator = React.forwardRef<ViewRef, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
));
ContextMenuSeparator.displayName = "ContextMenuSeparator";

const ContextMenuShortcut = ({ className, ...props }: TextProps) => (
  <Text className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />
);
ContextMenuShortcut.displayName = "ContextMenuShortcut";

/* -------------------------------------------------------------------------- */
/*                         Submenu (inline / expansível)                      */
/* -------------------------------------------------------------------------- */

// Submenus flutuantes não funcionam bem em telas de toque:
// aqui o submenu se expande inline, logo abaixo do gatilho.
const SubContext = React.createContext<{ open: boolean; setOpen: (o: boolean) => void } | null>(null);

const ContextMenuSub = ({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) => {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolled;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );
  const value = React.useMemo(() => ({ open, setOpen }), [open, setOpen]);
  return <SubContext.Provider value={value}>{children}</SubContext.Provider>;
};

const ContextMenuSubTrigger = React.forwardRef<
  ViewRef,
  Omit<PressableProps, "children"> & {
    inset?: boolean;
    className?: string;
    textClassName?: string;
    children?: React.ReactNode;
  }
>(({ className, textClassName, inset, children, onPress, ...props }, ref) => {
  const sub = React.useContext(SubContext);
  if (!sub) throw new Error("ContextMenuSubTrigger must be used within <ContextMenuSub>");
  const Icon = sub.open ? ChevronDown : ChevronRight;
  return (
    <Pressable
      ref={ref}
      onPress={(e) => {
        onPress?.(e);
        sub.setOpen(!sub.open);
      }}
      className={cn(
        "flex-row items-center rounded-sm px-2 py-1.5 active:bg-accent",
        sub.open && "bg-accent",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {renderChildren(children, cn(ITEM_TEXT, textClassName))}
      <View className="ml-auto">
        <Icon size={16} className="text-popover-foreground" />
      </View>
    </Pressable>
  );
});
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger";

const ContextMenuSubContent = React.forwardRef<ViewRef, ViewProps>(
  ({ className, ...props }, ref) => {
    const sub = React.useContext(SubContext);
    if (!sub?.open) return null;
    return (
      <View
        ref={ref}
        className={cn("ml-2 mt-1 border-l border-border pl-1", className)}
        {...props}
      />
    );
  },
);
ContextMenuSubContent.displayName = "ContextMenuSubContent";

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};