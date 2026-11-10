// components/primitives/chart.tsx
//
// O recharts só funciona na web (DOM/SVG do navegador), então não há conversão direta.
// Este arquivo mantém o que era independente do recharts no shadcn:
//   - ChartConfig (rótulos, ícones e cores por série)
//   - ChartContainer (contexto + medição de tamanho)
//   - ChartLegendContent e ChartTooltipContent (visuais em RN puro)
// O desenho do gráfico em si fica por conta de uma biblioteca nativa
// (ex.: react-native-gifted-charts), usando as cores de `useChart().resolveColor(chave)`.
import {
    createContext,
    useCallback,
    useContext,
    useState,
    type ComponentType,
    type ReactNode,
  } from "react";
  import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
  
  import { colors, fonts, radius } from "../../theme/colors";
  import { withAlpha } from "../../theme/alpha";
  import { shadow } from "../ui";
  
  // Era `{ light: "", dark: ".dark" }` (seletores CSS). Aqui só os nomes dos temas.
  export type ChartConfig = {
    [k in string]: {
      label?: ReactNode;
      icon?: ComponentType<{ size?: number; color?: string }>;
    } & (
      | { color?: string; theme?: never }
      | { color?: never; theme: { light: string; dark: string } }
    );
  };
  
  type ChartContextProps = {
    config: ChartConfig;
    /** Cor da série `key` no tema atual (equivale à variável CSS --color-<key>). */
    resolveColor: (key: string) => string | undefined;
    width: number;
    height: number;
  };
  
  const ChartContext = createContext<ChartContextProps | null>(null);
  
  export function useChart() {
    const context = useContext(ChartContext);
    if (!context) throw new Error("useChart must be used within a <ChartContainer />");
    return context;
  }
  
  export function ChartContainer({
    config,
    children,
    aspectRatio = 16 / 9,
    colorScheme = "light",
    style,
  }: {
    config: ChartConfig;
    /** Pode ser uma função que recebe o tamanho medido, útil para libs que exigem width/height. */
    children: ReactNode | ((size: { width: number; height: number }) => ReactNode);
    /** Equivale ao `aspect-video` (16/9). */
    aspectRatio?: number;
    /** O app só tem tema claro; o RN não troca sozinho como a classe `.dark` do web. */
    colorScheme?: "light" | "dark";
    style?: StyleProp<ViewStyle>;
  }) {
    const [width, setWidth] = useState(0);
    const height = width / aspectRatio;
  
    const resolveColor = useCallback(
      (key: string) => {
        const item = config[key];
        return item?.theme ? item.theme[colorScheme] : item?.color;
      },
      [config, colorScheme],
    );
  
    return (
      <ChartContext.Provider value={{ config, resolveColor, width, height }}>
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={[styles.container, { aspectRatio }, style]}
        >
          {width > 0 ? (typeof children === "function" ? children({ width, height }) : children) : null}
        </View>
      </ChartContext.Provider>
    );
  }
  
  /* ---------- Tooltip ---------- */
  
  export type ChartTooltipItem = {
    name?: string;
    dataKey?: string | number;
    value?: number | string;
    color?: string;
    type?: string;
    payload?: Record<string, unknown> & { fill?: string };
  };
  
  export function ChartTooltipContent({
    active,
    payload,
    label,
    indicator = "dot",
    hideLabel = false,
    hideIndicator = false,
    nameKey,
    labelKey,
    color,
    labelFormatter,
    formatter,
    style,
    labelStyle,
  }: {
    active?: boolean;
    payload?: ChartTooltipItem[];
    label?: ReactNode;
    indicator?: "line" | "dot" | "dashed";
    hideLabel?: boolean;
    hideIndicator?: boolean;
    nameKey?: string;
    labelKey?: string;
    color?: string;
    labelFormatter?: (value: ReactNode, payload: ChartTooltipItem[]) => ReactNode;
    formatter?: (
      value: number | string,
      name: string,
      item: ChartTooltipItem,
      index: number,
      payload: ChartTooltipItem["payload"],
    ) => ReactNode;
    style?: StyleProp<ViewStyle>;
    labelStyle?: StyleProp<TextStyle>;
  }) {
    const { config } = useChart();
  
    if (!active || !payload?.length) return null;
  
    const nestLabel = payload.length === 1 && indicator !== "dot";
  
    let tooltipLabel: ReactNode = null;
    if (!hideLabel) {
      const [item] = payload;
      const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === "string" ? config[label as keyof typeof config]?.label || label : itemConfig?.label;
  
      if (labelFormatter) tooltipLabel = <Text style={[styles.tooltipLabel, labelStyle]}>{labelFormatter(value, payload)}</Text>;
      else if (value) tooltipLabel = <Text style={[styles.tooltipLabel, labelStyle]}>{value}</Text>;
    }
  
    return (
      <View style={[styles.tooltip, style]}>
        {!nestLabel ? tooltipLabel : null}
        <View style={styles.tooltipItems}>
          {payload
            .filter((item) => item.type !== "none")
            .map((item, index) => {
              const key = `${nameKey || item.name || item.dataKey || "value"}`;
              const itemConfig = getPayloadConfigFromPayload(config, item, key);
              const indicatorColor = color || item.payload?.fill || item.color;
              const Icon = itemConfig?.icon;
  
              return (
                <View
                  key={String(item.dataKey ?? index)}
                  style={[styles.tooltipRow, { alignItems: indicator === "dot" ? "center" : "stretch" }]}
                >
                  {formatter && item.value !== undefined && item.name ? (
                    formatter(item.value, item.name, item, index, item.payload)
                  ) : (
                    <>
                      {Icon ? (
                        <Icon size={10} color={colors.mutedForeground} />
                      ) : !hideIndicator ? (
                        <View
                          style={[
                            styles.indicatorBase,
                            indicator === "dot" && { width: 10, height: 10, backgroundColor: indicatorColor },
                            indicator === "line" && { width: 4, backgroundColor: indicatorColor },
                            indicator === "dashed" && {
                              width: 0,
                              borderWidth: 1.5,
                              borderStyle: "dashed",
                              borderColor: indicatorColor,
                              marginVertical: nestLabel ? 2 : 0,
                            },
                          ]}
                        />
                      ) : null}
                      <View style={[styles.tooltipBody, { alignItems: nestLabel ? "flex-end" : "center" }]}>
                        <View style={styles.tooltipNames}>
                          {nestLabel ? tooltipLabel : null}
                          <Text style={styles.tooltipName}>{itemConfig?.label || item.name}</Text>
                        </View>
                        {item.value !== undefined && item.value !== null ? (
                          <Text style={styles.tooltipValue}>{String(item.value)}</Text>
                        ) : null}
                      </View>
                    </>
                  )}
                </View>
              );
            })}
        </View>
      </View>
    );
  }
  
  /* ---------- Legenda ---------- */
  
  export type ChartLegendItem = { value?: string; dataKey?: string; color?: string; type?: string };
  
  /** Sem `payload`, lista todas as séries do `config`. */
  export function ChartLegendContent({
    payload,
    hideIcon = false,
    nameKey,
    verticalAlign = "bottom",
    style,
  }: {
    payload?: ChartLegendItem[];
    hideIcon?: boolean;
    nameKey?: string;
    verticalAlign?: "top" | "bottom";
    style?: StyleProp<ViewStyle>;
  }) {
    const { config, resolveColor } = useChart();
  
    const items: ChartLegendItem[] =
      payload ?? Object.keys(config).map((k) => ({ value: k, dataKey: k, color: resolveColor(k) }));
  
    if (!items.length) return null;
  
    return (
      <View style={[styles.legend, verticalAlign === "top" ? { paddingBottom: 12 } : { paddingTop: 12 }, style]}>
        {items
          .filter((item) => item.type !== "none")
          .map((item, i) => {
            const key = `${nameKey || item.dataKey || "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const Icon = itemConfig?.icon;
            return (
              <View key={item.value ?? i} style={styles.legendItem}>
                {Icon && !hideIcon ? (
                  <Icon size={12} color={colors.mutedForeground} />
                ) : (
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                )}
                <Text style={styles.legendText}>{itemConfig?.label ?? item.value}</Text>
              </View>
            );
          })}
      </View>
    );
  }
  
  // Extrai a configuração de um item a partir do payload (mesma lógica do shadcn).
  function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
    if (typeof payload !== "object" || payload === null) return undefined;
  
    const payloadPayload =
      "payload" in payload && typeof payload.payload === "object" && payload.payload !== null
        ? payload.payload
        : undefined;
  
    let configLabelKey: string = key;
  
    if (key in payload && typeof payload[key as keyof typeof payload] === "string") {
      configLabelKey = payload[key as keyof typeof payload] as string;
    } else if (
      payloadPayload &&
      key in payloadPayload &&
      typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
    ) {
      configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
    }
  
    return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config];
  }
  
  const mono = Platform.select({ ios: "Menlo", default: "monospace" });
  
  const styles = StyleSheet.create({
    container: { width: "100%", alignItems: "center", justifyContent: "center" },
  
    tooltip: {
      minWidth: 128,
      gap: 6,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.5),
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...shadow.md,
    },
    tooltipLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.foreground },
    tooltipItems: { gap: 6 },
    tooltipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
    indicatorBase: { borderRadius: 2 },
    tooltipBody: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
    tooltipNames: { gap: 6 },
    tooltipName: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
    tooltipValue: {
      fontFamily: mono,
      fontWeight: "500",
      fontSize: 12,
      fontVariant: ["tabular-nums"],
      color: colors.foreground,
    } as TextStyle,
  
    legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 16 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 2 },
    legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.foreground },
  });