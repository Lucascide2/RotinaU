import * as React from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from "react-native";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

type DrawerContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  dismissible: boolean;
};

type TextRef = React.ComponentRef<typeof Text>;
type ViewRef = React.ComponentRef<typeof View>

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

function useDrawer() {
  const ctx = React.useContext(DrawerContext);
  if (!ctx) throw new Error("Drawer components must be used within <Drawer>");
  return ctx;
}

interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Permite fechar tocando no fundo, arrastando ou pelo botão voltar. */
  dismissible?: boolean;
  children?: React.ReactNode;
}

// `shouldScaleBackground` (vaul) não tem equivalente no RN e foi removido.
const Drawer = ({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  dismissible = true,
  children,
}: DrawerProps) => {
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

  const value = React.useMemo(() => ({ open, setOpen, dismissible }), [open, setOpen, dismissible]);

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};
Drawer.displayName = "Drawer";

/* -------------------------------------------------------------------------- */
/*                              Trigger / Close                               */
/* -------------------------------------------------------------------------- */

const DrawerTrigger = React.forwardRef<ViewRef, PressableProps>(({ onPress, ...props }, ref) => {
  const { setOpen } = useDrawer();
  return (
    <Pressable
      ref={ref}
      onPress={(e) => {
        onPress?.(e);
        setOpen(true);
      }}
      {...props}
    />
  );
});
DrawerTrigger.displayName = "DrawerTrigger";

const DrawerClose = React.forwardRef<ViewRef, PressableProps>(({ onPress, ...props }, ref) => {
  const { setOpen } = useDrawer();
  return (
    <Pressable
      ref={ref}
      onPress={(e) => {
        onPress?.(e);
        setOpen(false);
      }}
      {...props}
    />
  );
});
DrawerClose.displayName = "DrawerClose";

// O <Modal> já funciona como portal no RN
const DrawerPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

/* -------------------------------------------------------------------------- */
/*                                   Overlay                                  */
/* -------------------------------------------------------------------------- */

interface DrawerOverlayProps extends ViewProps {
  opacity?: Animated.Value | Animated.AnimatedInterpolation<number>;
  onPress?: () => void;
}

const DrawerOverlay = React.forwardRef<ViewRef, DrawerOverlayProps>(
  ({ className, opacity, onPress, style, ...props }, ref) => (
    <Animated.View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, opacity !== undefined && { opacity }, style]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
        <View ref={ref} className={cn("flex-1 bg-black/80", className)} {...props} />
      </Pressable>
    </Animated.View>
  ),
);
DrawerOverlay.displayName = "DrawerOverlay";

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

const DrawerContent = React.forwardRef<ViewRef, ViewProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, dismissible } = useDrawer();
    const { height: screenH } = useWindowDimensions();

    const [mounted, setMounted] = React.useState(open);
    const translateY = React.useRef(new Animated.Value(screenH)).current;

    // Opacidade do fundo acompanha a posição do drawer
    const overlayOpacity = translateY.interpolate({
      inputRange: [0, screenH],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });

    const handleDismiss = React.useCallback(() => {
        if (dismissible) setOpen(false);
      }, [dismissible, setOpen]);

    // Abre / fecha com animação
    React.useEffect(() => {
      if (open) {
        setMounted(true);
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 14,
        }).start();
      } else if (mounted) {
        Animated.timing(translateY, {
          toValue: screenH,
          duration: 220,
          useNativeDriver: true,
        }).start(({ finished }) => finished && setMounted(false));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Arrastar a alça para baixo fecha o drawer (equivalente ao gesto do vaul)
    const panResponder = React.useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => dismissible,
          onMoveShouldSetPanResponder: (_, g) => dismissible && Math.abs(g.dy) > 4,
          onPanResponderMove: (_, g) => {
            if (g.dy > 0) translateY.setValue(g.dy);
          },
          onPanResponderRelease: (_, g) => {
            if (g.dy > 100 || g.vy > 0.6) {
              setOpen(false);
            } else {
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 0,
              }).start();
            }
          },
        }),
      [dismissible, setOpen, translateY],
    );

    return (
      <DrawerPortal>
        <Modal
          visible={mounted}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={handleDismiss}
        >
          <DrawerOverlay opacity={overlayOpacity} onPress={() => dismissible && setOpen(false)} />

          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: screenH * 0.9,
              transform: [{ translateY }],
            }}
          >
            <View
              ref={ref}
              className={cn(
                "mt-24 flex-col rounded-t-[10px] border border-border bg-background",
                className,
              )}
              {...props}
            >
              {/* Alça de arraste */}
              <View {...panResponder.panHandlers} className="items-center pb-2 pt-4">
                <View className="h-2 w-[100px] rounded-full bg-muted" />
              </View>
              {children}
            </View>
          </Animated.View>
        </Modal>
      </DrawerPortal>
    );
  },
);
DrawerContent.displayName = "DrawerContent";

/* -------------------------------------------------------------------------- */
/*                         Header / Footer / Title / Desc                     */
/* -------------------------------------------------------------------------- */

const DrawerHeader = ({ className, ...props }: ViewProps) => (
  <View className={cn("items-center gap-1.5 p-4", className)} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: ViewProps) => (
  <View className={cn("mt-auto flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<TextRef, TextProps>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    accessibilityRole="header"
    className={cn("text-lg font-semibold leading-none tracking-tight text-foreground", className)}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = React.forwardRef<TextRef, TextProps>(({ className, ...props }, ref) => (
  <Text ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DrawerDescription.displayName = "DrawerDescription";

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};