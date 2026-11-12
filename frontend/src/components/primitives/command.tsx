// components/primitives/command.tsx
// Substitui cmdk. Cada <CommandItem> se registra no <Command>, que filtra pelo texto digitado
// no <CommandInput>. Grupos e o "vazio" aparecem/somem conforme os itens visíveis.
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useState,
    type ReactNode,
  } from "react";
  import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    type StyleProp,
    type TextInputProps,
    type TextStyle,
    type ViewStyle,
  } from "react-native";
  import { Search } from "lucide-react-native";
  
  import { colors, fonts, radius } from "../../theme/colors";
  import { shadow } from "../ui";
  
  /* ---------- Filtro ---------- */
  
  /** Devolve 0 para esconder o item; qualquer valor > 0 mantém visível. */
  export type CommandFilter = (value: string, search: string, keywords?: string[]) => number;
  
  function normalize(text: string): string {
    try {
      return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    } catch {
      return text.toLowerCase(); // se normalize não existir, ao menos ignora maiúsculas
    }
  }
  
  /** Ignora acentos e maiúsculas; aceita trecho contínuo ou letras em sequência. */
  const defaultFilter: CommandFilter = (value, search, keywords) => {
    const s = normalize(search.trim());
    if (!s) return 1;
    const hay = normalize([value, ...(keywords ?? [])].join(" "));
    const i = hay.indexOf(s);
    if (i >= 0) return 1 - Math.min(i, 50) / 100;
    let j = 0;
    for (const ch of hay) {
      if (ch === s[j]) j++;
      if (j === s.length) return 0.1;
    }
    return 0;
  };
  
  /* ---------- Contexto ---------- */
  
  type ItemEntry = { value: string; keywords?: string[]; groupId: string | null };
  
  type CommandCtx = {
    search: string;
    setSearch: (s: string) => void;
    filter: CommandFilter;
    shouldFilter: boolean;
    items: Map<string, ItemEntry>;
    register: (id: string, entry: ItemEntry) => void;
    unregister: (id: string) => void;
    /** true dentro do CommandDialog (itens e input mais altos). */
    dense: boolean;
  };
  
  const CommandContext = createContext<CommandCtx | null>(null);
  const GroupContext = createContext<string | null>(null);
  
  function useCommand() {
    const ctx = useContext(CommandContext);
    if (!ctx) throw new Error("Componentes de Command devem estar dentro de <Command>.");
    return ctx;
  }
  
  /* ---------- Command ---------- */
  
  export function Command({
    children,
    filter = defaultFilter,
    shouldFilter = true,
    dense = false,
    style,
  }: {
    children?: ReactNode;
    filter?: CommandFilter;
    /** false desliga o filtro (útil se você filtra os dados por conta própria). */
    shouldFilter?: boolean;
    dense?: boolean;
    style?: StyleProp<ViewStyle>;
  }) {
    const [search, setSearch] = useState("");
    const [items, setItems] = useState<Map<string, ItemEntry>>(new Map());
  
    const register = useCallback((id: string, entry: ItemEntry) => {
      setItems((prev) => new Map(prev).set(id, entry));
    }, []);
    const unregister = useCallback((id: string) => {
      setItems((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }, []);
  
    const ctx = useMemo<CommandCtx>(
      () => ({ search, setSearch, filter, shouldFilter, items, register, unregister, dense }),
      [search, filter, shouldFilter, items, register, unregister, dense],
    );
  
    return (
      <CommandContext.Provider value={ctx}>
        <View style={[styles.root, style]}>{children}</View>
      </CommandContext.Provider>
    );
  }
  
  /* ---------- Dialog ---------- */
  
  /** Substitui Dialog + DialogContent do shadcn usando o Modal nativo. Toque fora para fechar. */
  export function CommandDialog({
    open,
    onOpenChange,
    children,
    filter,
    shouldFilter,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children?: ReactNode;
    filter?: CommandFilter;
    shouldFilter?: boolean;
  }) {
    return (
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => onOpenChange(false)}
      >
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.overlay} onPress={() => onOpenChange(false)} accessibilityLabel="Fechar">
            {/* Pressable interno impede que tocar dentro do cartão feche o diálogo */}
            <Pressable style={styles.dialog} onPress={() => {}}>
              <Command dense filter={filter} shouldFilter={shouldFilter}>
                {children}
              </Command>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
  
  /* ---------- Input ---------- */
  
  export function CommandInput({
    value,
    onValueChange,
    style,
    ...props
  }: Omit<TextInputProps, "value" | "onChangeText" | "style"> & {
    value?: string;
    onValueChange?: (value: string) => void;
    style?: StyleProp<TextStyle>;
  }) {
    const { search, setSearch, dense } = useCommand();
  
    // Modo controlado: mantém o filtro do Command em sincronia com `value`.
    useEffect(() => {
      if (value !== undefined) setSearch(value);
    }, [value, setSearch]);
  
    return (
      <View style={styles.inputWrapper}>
        <Search size={dense ? 20 : 16} color={colors.mutedForeground} style={styles.searchIcon} />
        <TextInput
          {...props}
          value={value ?? search}
          onChangeText={(t) => {
            setSearch(t);
            onValueChange?.(t);
          }}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.primary}
          autoCorrect={false}
          style={[styles.input, { height: dense ? 48 : 40 }, style]}
        />
      </View>
    );
  }
  
  /* ---------- List / Empty ---------- */
  
  export function CommandList({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={[styles.list, style]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  
  export function CommandEmpty({ children, style }: { children?: ReactNode; style?: StyleProp<TextStyle> }) {
    const { items, search, filter, shouldFilter } = useCommand();
    const total = items.size;
    const visible = [...items.values()].filter(
      (it) => !shouldFilter || filter(it.value, search, it.keywords) > 0,
    ).length;
    // total === 0 evita um "flash" do texto antes de os itens se registrarem.
    if (total === 0 || visible > 0) return null;
    return typeof children === "string" || children === undefined ? (
      <Text style={[styles.empty, style]}>{children}</Text>
    ) : (
      <>{children}</>
    );
  }
  
  /* ---------- Group / Separator ---------- */
  
  export function CommandGroup({
    heading,
    children,
    style,
  }: {
    heading?: ReactNode;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
  }) {
    const { items, search, filter, shouldFilter, dense } = useCommand();
    const id = useId();
  
    // Some quando há busca e nenhum item do grupo combina.
    const searching = shouldFilter && search.trim().length > 0;
    const hasVisible = [...items.values()].some(
      (it) => it.groupId === id && filter(it.value, search, it.keywords) > 0,
    );
    const hidden = searching && items.size > 0 && !hasVisible;
  
    return (
      <GroupContext.Provider value={id}>
        {/* Mantém montado (mas invisível) para os itens continuarem registrados. */}
        <View style={[styles.group, dense && styles.groupDense, hidden && styles.hidden, style]}>
          {heading ? (
            typeof heading === "string" ? <Text style={styles.heading}>{heading}</Text> : heading
          ) : null}
          {children}
        </View>
      </GroupContext.Provider>
    );
  }
  
  export function CommandSeparator({ style }: { style?: StyleProp<ViewStyle> }) {
    const { search } = useCommand();
    if (search.trim()) return null; // como no cmdk, some durante a busca
    return <View style={[styles.separator, style]} />;
  }
  
  /* ---------- Item / Shortcut ---------- */
  
  export function CommandItem({
    value,
    keywords,
    disabled,
    onSelect,
    children,
    style,
    textStyle,
  }: {
    /** Texto usado na busca. Se omitido e `children` for string, usa o próprio texto. */
    value?: string;
    keywords?: string[];
    disabled?: boolean;
    onSelect?: (value: string) => void;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
  }) {
    const { search, filter, shouldFilter, register, unregister, dense } = useCommand();
    const groupId = useContext(GroupContext);
    const id = useId();
    const text = value ?? (typeof children === "string" ? children : "");
    const keywordsKey = keywords?.join("\u0000");
  
    useEffect(() => {
      register(id, { value: text, keywords, groupId });
      return () => unregister(id);
    }, [id, text, keywordsKey, groupId]); // eslint-disable-line react-hooks/exhaustive-deps
  
    const visible = !shouldFilter || filter(text, search, keywords) > 0;
    if (!visible) return null;
  
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => onSelect?.(text)}
        style={({ pressed }) => [
          styles.item,
          dense && styles.itemDense,
          pressed && { backgroundColor: colors.accent },
          disabled && styles.disabled,
          style,
        ]}
      >
        {({ pressed }) =>
          typeof children === "string" ? (
            <Text style={[styles.itemText, pressed && { color: colors.accentForeground }, textStyle]}>{children}</Text>
          ) : (
            children
          )
        }
      </Pressable>
    );
  }
  
  export function CommandShortcut({ children, style }: { children?: ReactNode; style?: StyleProp<TextStyle> }) {
    return <Text style={[styles.shortcut, style]}>{children}</Text>;
  }
  
  /* ---------- Estilos ---------- */
  
  const styles = StyleSheet.create({
    flex: { flex: 1 },
    root: {
      width: "100%",
      overflow: "hidden",
      borderRadius: radius.md,
      backgroundColor: colors.popover,
    },
  
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: 80,
      paddingHorizontal: 16,
      backgroundColor: "rgba(0,0,0,0.8)",
    },
    dialog: {
      width: "100%",
      maxWidth: 512,
      overflow: "hidden",
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      ...shadow.md,
    },
  
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 12,
    },
    searchIcon: { marginRight: 8, opacity: 0.5 },
    input: {
      flex: 1,
      paddingVertical: 0,
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.popoverForeground,
    },
  
    list: { maxHeight: 300 },
    empty: {
      paddingVertical: 24,
      textAlign: "center",
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.foreground,
    },
  
    group: { padding: 4 },
    groupDense: { paddingHorizontal: 8 },
    hidden: { display: "none" },
    heading: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontFamily: fonts.medium,
      fontSize: 12,
      color: colors.mutedForeground,
    },
    separator: { height: 1, marginHorizontal: -4, backgroundColor: colors.border },
  
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    itemDense: { paddingVertical: 12 },
    itemText: { fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },
    disabled: { opacity: 0.5 },
  
    shortcut: {
      marginLeft: "auto",
      fontFamily: fonts.regular,
      fontSize: 12,
      letterSpacing: 1.2,
      color: colors.mutedForeground,
    },
  });