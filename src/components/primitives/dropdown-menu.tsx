import * as React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import { Check, ChevronDown, ChevronRight } from "lucide-react-native";
import { cssInterop } from "nativewind";

import { cn } from "@/lib/utils";

// Tipos de ref compatíveis com as typings mais novas do React Native
type ViewRef = React.ComponentRef<typeof View>;
type TextRef = React.ComponentRef<typeof Text>;

// Permite usar `className="text-..."` para colorir os ícones do lucide
[Check, ChevronDown, ChevronRight].forEach((Icon) =>
  cssInterop(Icon, {
    className: { target: "style", nativeStyleToProp: { color: true } },
  }),
);

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

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

type Anchor = { x: number; y: number; width: number; height: number };

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  anchor: Anchor;
  openFrom: (anchor: Anchor) => void;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenu components must be used within <DropdownMenu>");
  return ctx;
}

interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const DropdownMenu = ({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: DropdownMenuProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const [anchor, setAnchor] = React.useState<Anchor>({ x: 0, y: 0, width: 0, height: 0 });
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const openFrom = React.useCallback(
    (next: Anchor) => {
      setAnchor(next);
      setOpen(true);
    },
    [setOpen],
  );

  const value = React.useMemo(
    () => ({ open, setOpen, anchor, openFrom }),
    [open, setOpen, anchor, openFrom],
  );

  return <DropdownMenuContext.Provider value={value}>{children}</DropdownMenuContext.Provider>;
};

/* -------------------------------------------------------------------------- */
/*                                   Trigger                                  */
/* -------------------------------------------------------------------------- */

// Mede a posição do gatilho para ancorar o menu logo abaixo dele
const DropdownMenuTrigger = React.forwardRef<ViewRef, PressableProps>(
  ({ onPress, ...props }, ref) => {
    const { openFrom } = useDropdownMenu();
    const innerRef = React.useRef<ViewRef>(null);
    React.useImperativeHandle(ref, () => innerRef.current as ViewRef);

    return (
      <Pressable
        ref={innerRef}
        onPress={(e) => {
          onPress?.(e);
          innerRef.current?.measureInWindow((x, y, width, height) => {
            openFrom({ x, y, width, height });
          });
        }}
        {...props}
      />
    );
  },
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

/* -------------------------------------------------------------------------- */
/*                           Group / Portal (simples)                         */
/* -------------------------------------------------------------------------- */

const DropdownMenuGroup = (props: ViewProps) => <View {...props} />;

// O <Modal> já funciona como portal no RN
const DropdownMenuPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

interface DropdownMenuContentProps extends ViewProps {
  sideOffset?: number;
  align?: "start" | "center" | "end";
}

const DropdownMenuContent = React.forwardRef<ViewRef, DropdownMenuContentProps>(
  ({ className, style, sideOffset = 4, align = "start", children, ...props }, ref) => {
    const { open, setOpen, anchor } = useDropdownMenu();
    const { width: screenW, height: screenH } = useWindowDimensions();
    const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

    React.useEffect(() => {
      if (!open) setSize(null);
    }, [open]);

    const margin = 8;
    let left = anchor.x;
    let top = anchor.y + anchor.height + sideOffset;

    if (size) {
      // Alinhamento horizontal em relação ao gatilho
      if (align === "end") left = anchor.x + anchor.width - size.w;
      else if (align === "center") left = anchor.x + (anchor.width - size.w) / 2;
      left = Math.max(margin, Math.min(left, screenW - size.w - margin));

      // Se não couber abaixo, abre acima (quando houver mais espaço)
      const spaceBelow = screenH - top - margin;
      const spaceAbove = anchor.y - sideOffset - margin;
      if (size.h > spaceBelow && spaceAbove > spaceBelow) {
        top = anchor.y - sideOffset - size.h;
      }
      top = Math.max(margin, Math.min(top, screenH - size.h - margin));
    }

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
            {
              position: "absolute",
              left,
              top,
              maxHeight: screenH - margin * 2,
              opacity: size ? 1 : 0,
            },
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
DropdownMenuContent.displayName = "DropdownMenuContent";

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
  const { setOpen } = useDropdownMenu();
  return React.useCallback(
    (cb?: (event: SelectEvent) => void) => {
      const event = createSelectEvent();
      cb?.(event);
      if (!event.defaultPrevented) setOpen(false);
    },
    [setOpen],
  );
}

const DropdownMenuItem = React.forwardRef<ViewRef, ItemBaseProps & { inset?: boolean }>(
  ({ className, textClassName, inset, disabled, onSelect, children, ...props }, ref) => {
    const select = useSelect();
    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        onPress={() => select(onSelect)}
        className={cn(
          "relative flex-row items-center gap-2 rounded-sm px-2 py-1.5 active:bg-accent",
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
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuCheckboxItem = React.forwardRef<
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
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

/* ------------------------------- Radio group ------------------------------ */

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

const DropdownMenuRadioGroup = ({
  value,
  onValueChange,
  ...props
}: ViewProps & { value?: string; onValueChange?: (value: string) => void }) => (
  <RadioGroupContext.Provider value={{ value, onValueChange }}>
    <View {...props} />
  </RadioGroupContext.Provider>
);

const DropdownMenuRadioItem = React.forwardRef<ViewRef, ItemBaseProps & { value: string }>(
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
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

/* -------------------------------------------------------------------------- */
/*                         Label / Separator / Shortcut                       */
/* -------------------------------------------------------------------------- */

const DropdownMenuLabel = React.forwardRef<TextRef, TextProps & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn(
        "px-2 py-1.5 text-sm font-semibold text-popover-foreground",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  ),
);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<ViewRef, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
  ),
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuShortcut = ({ className, ...props }: TextProps) => (
  <Text
    className={cn("ml-auto text-xs tracking-widest text-popover-foreground opacity-60", className)}
    {...props}
  />
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

/* -------------------------------------------------------------------------- */
/*                         Submenu (inline / expansível)                      */
/* -------------------------------------------------------------------------- */

// Submenus flutuantes não funcionam bem em telas de toque:
// aqui o submenu se expande inline, logo abaixo do gatilho.
const SubContext = React.createContext<{ open: boolean; setOpen: (o: boolean) => void } | null>(
  null,
);

const DropdownMenuSub = ({
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

const DropdownMenuSubTrigger = React.forwardRef<
  ViewRef,
  Omit<PressableProps, "children"> & {
    inset?: boolean;
    className?: string;
    textClassName?: string;
    children?: React.ReactNode;
  }
>(({ className, textClassName, inset, children, onPress, ...props }, ref) => {
  const sub = React.useContext(SubContext);
  if (!sub) throw new Error("DropdownMenuSubTrigger must be used within <DropdownMenuSub>");
  const Icon = sub.open ? ChevronDown : ChevronRight;
  return (
    <Pressable
      ref={ref}
      onPress={(e) => {
        onPress?.(e);
        sub.setOpen(!sub.open);
      }}
      className={cn(
        "flex-row items-center gap-2 rounded-sm px-2 py-1.5 active:bg-accent",
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
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

const DropdownMenuSubContent = React.forwardRef<ViewRef, ViewProps>(
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
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};