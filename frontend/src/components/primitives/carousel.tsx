// components/primitives/carousel.tsx
// Substitui embla-carousel-react por um ScrollView com snap.
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    Children,
    type ComponentRef,
    type ReactNode,
    type RefObject,
  } from "react";
  import {
    ScrollView,
    View,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type StyleProp,
    type ViewStyle,
  } from "react-native";
  import { ArrowLeft, ArrowRight } from "lucide-react-native";
  
  import { Button, type ButtonProps } from "./button";
  import { colors } from "../../theme/colors";
  
  /** Subconjunto da API do Embla que faz sentido aqui. */
  export type CarouselApi = {
    scrollPrev: () => void;
    scrollNext: () => void;
    scrollTo: (index: number) => void;
    canScrollPrev: () => boolean;
    canScrollNext: () => boolean;
    selectedScrollSnap: () => number;
  };
  
  type CarouselProps = {
    orientation?: "horizontal" | "vertical";
    opts?: { startIndex?: number };
    setApi?: (api: CarouselApi) => void;
    /** Quantos itens cabem na tela ao mesmo tempo (era o `basis-*` do CarouselItem). */
    itemsPerView?: number;
    /** Espaço entre itens, em px (era o pl-4 / -ml-4). */
    gap?: number;
    onSelectedIndexChange?: (index: number) => void;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
  };
  
  type ScrollViewInstance = ComponentRef<typeof ScrollView>;

  type Ctx = {
    orientation: "horizontal" | "vertical";
    itemSize: number;
    gap: number;
    interval: number;
    scrollRef: RefObject<ScrollViewInstance | null>;
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    setCount: (n: number) => void;
    scrollPrev: () => void;
    scrollNext: () => void;
    canScrollPrev: boolean;
    canScrollNext: boolean;
    ready: boolean;
  };
  
  const CarouselContext = createContext<Ctx | null>(null);
  
  export function useCarousel() {
    const ctx = useContext(CarouselContext);
    if (!ctx) throw new Error("useCarousel must be used within a <Carousel />");
    return ctx;
  }
  
  export function Carousel({
    orientation = "horizontal",
    opts,
    setApi,
    itemsPerView = 1,
    gap = 16,
    onSelectedIndexChange,
    children,
    style,
  }: CarouselProps) {
    const scrollRef = useRef<ScrollViewInstance | null>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [index, setIndex] = useState(opts?.startIndex ?? 0);
    const [count, setCount] = useState(0);
    const startedRef = useRef(false);
  
    const horizontal = orientation === "horizontal";
    const mainSize = horizontal ? size.width : size.height;
    const ready = mainSize > 0;
    const itemSize = ready ? (mainSize - gap * (itemsPerView - 1)) / itemsPerView : 0;
    const interval = itemSize + gap;
    const maxIndex = Math.max(0, count - itemsPerView);
  
    const scrollTo = (i: number) => {
      const clamped = Math.min(Math.max(i, 0), maxIndex);
      scrollRef.current?.scrollTo(horizontal ? { x: clamped * interval, animated: true } : { y: clamped * interval, animated: true });
    };
  
    // Posição inicial (opts.startIndex), uma única vez, quando o tamanho já é conhecido.
    useEffect(() => {
      if (!ready || startedRef.current) return;
      startedRef.current = true;
      const start = opts?.startIndex ?? 0;
      if (start > 0) {
        scrollRef.current?.scrollTo(horizontal ? { x: start * interval, animated: false } : { y: start * interval, animated: false });
      }
    }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  
    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!ready) return;
      const offset = horizontal ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y;
      const i = Math.min(Math.max(Math.round(offset / interval), 0), maxIndex);
      if (i !== index) {
        setIndex(i);
        onSelectedIndexChange?.(i);
      }
    };
  
    const api = useMemo<CarouselApi>(
      () => ({
        scrollPrev: () => scrollTo(index - 1),
        scrollNext: () => scrollTo(index + 1),
        scrollTo,
        canScrollPrev: () => index > 0,
        canScrollNext: () => index < maxIndex,
        selectedScrollSnap: () => index,
      }),
      [index, maxIndex, interval, horizontal], // eslint-disable-line react-hooks/exhaustive-deps
    );
  
    useEffect(() => {
      setApi?.(api);
    }, [api, setApi]);
  
    const onLayout = (e: LayoutChangeEvent) => setSize(e.nativeEvent.layout);
  
    return (
      <CarouselContext.Provider
        value={{
          orientation,
          itemSize,
          gap,
          interval,
          scrollRef,
          onScroll,
          setCount,
          scrollPrev: api.scrollPrev,
          scrollNext: api.scrollNext,
          canScrollPrev: index > 0,
          canScrollNext: index < maxIndex,
          ready,
        }}
      >
        <View accessibilityLabel="carousel" onLayout={onLayout} style={[{ position: "relative" }, style]}>
          {children}
        </View>
      </CarouselContext.Provider>
    );
  }
  
  export function CarouselContent({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
    const { orientation, gap, interval, scrollRef, onScroll, setCount, ready } = useCarousel();
    const count = Children.count(children);
  
    useEffect(() => {
      setCount(count);
    }, [count, setCount]);
  
    if (!ready) return null;
  
    return (
      <ScrollView
        ref={scrollRef}
        horizontal={orientation === "horizontal"}
        snapToInterval={interval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={[{ gap }, style]}
      >
        {children}
      </ScrollView>
    );
  }
  
  export function CarouselItem({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
    const { orientation, itemSize } = useCarousel();
    return (
      <View
        accessibilityLabel="slide"
        style={[orientation === "horizontal" ? { width: itemSize } : { height: itemSize }, style]}
      >
        {children}
      </View>
    );
  }
  
  /**
   * No web os botões ficavam fora do carrossel (-left-12). No celular não há espaço
   * lateral, então ficam sobrepostos às bordas. Sobrescreva com `style` se precisar.
   */
  export function CarouselPrevious({ variant = "outline", size = "icon", style, ...props }: ButtonProps) {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();
    const horizontal = orientation === "horizontal";
    return (
      <Button
        variant={variant}
        size={size}
        accessibilityLabel="Slide anterior"
        disabled={!canScrollPrev}
        onPress={scrollPrev}
        style={[
          { position: "absolute", width: 32, height: 32, borderRadius: 9999 },
          horizontal
            ? { left: 8, top: "50%", marginTop: -16 }
            : { top: 8, left: "50%", marginLeft: -16, transform: [{ rotate: "90deg" }] },
          style,
        ]}
        {...props}
      >
        <ArrowLeft size={16} color={colors.foreground} />
      </Button>
    );
  }
  
  export function CarouselNext({ variant = "outline", size = "icon", style, ...props }: ButtonProps) {
    const { orientation, scrollNext, canScrollNext } = useCarousel();
    const horizontal = orientation === "horizontal";
    return (
      <Button
        variant={variant}
        size={size}
        accessibilityLabel="Próximo slide"
        disabled={!canScrollNext}
        onPress={scrollNext}
        style={[
          { position: "absolute", width: 32, height: 32, borderRadius: 9999 },
          horizontal
            ? { right: 8, top: "50%", marginTop: -16 }
            : { bottom: 8, left: "50%", marginLeft: -16, transform: [{ rotate: "90deg" }] },
          style,
        ]}
        {...props}
      >
        <ArrowRight size={16} color={colors.foreground} />
      </Button>
    );
  }