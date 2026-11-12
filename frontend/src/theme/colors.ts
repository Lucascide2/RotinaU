// theme/colors.ts
// Convertido de styles.css (oklch -> hex). Tema claro apenas:
// o CSS declarava a variante `dark`, mas não definia nenhum valor para ela.

export const colors = {
    // Superfícies
    frame: "#e6e7ef", // fundo externo (era o background do <body>)
    background: "#f6f6fb",
    foreground: "#1d1e29",
    card: "#ffffff",
    cardForeground: "#1d1e29",
    popover: "#ffffff",
    popoverForeground: "#1d1e29",
  
    // Marca
    primary: "#5b4cdc",
    primaryForeground: "#fcfcfc",
    primarySoft: "#e8e8ff",
    secondary: "#ededfc",
    secondaryForeground: "#3e2da4",
    accent: "#e8e8ff",
    accentForeground: "#3e2da4",
  
    // Neutras
    muted: "#edeef4",
    mutedForeground: "#6f717d",
    border: "#e3e4eb",
    input: "#d6d7de",
    ring: "#5b4cdc",
  
    // Estado
    destructive: "#de3b3d",
    destructiveForeground: "#fcfcfc",
  
    // Prioridades
    high: "#ea942f",
    medium: "#3284d0",
    low: "#2b9667",
  
    // Semânticas do app
    success: "#008856",
    successSoft: "#d9f7e5",
    early: "#0082a9",
    earlySoft: "#d6f5ff",
    breakAccent: "#004383",
    warning: "#c26300",
    warningSoft: "#ffefd5",
    review: "#8a3d9a",
    reviewSoft: "#f8e8fb",
  } as const;
  
  // --gradient-primary: linear-gradient(135deg, ...)
  // Use com <LinearGradient> do expo-linear-gradient (veja abaixo).
  export const gradients = {
    primary: {
      colors: ["#5645d5", "#7d5be6"] as const,
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 }, // aproxima os 135deg
    },
  } as const;
  
  // --radius: 0.875rem = 14px
  // sm = radius - 4, md = radius - 2, lg = radius, xl = radius + 4, 2xl = radius + 8
  export const radius = {
    sm: 10,
    md: 12,
    lg: 14,
    xl: 18,
    "2xl": 22,
    full: 9999,
  } as const;
  
  export const fonts = {
    regular: "PlusJakartaSans_400Regular",
    medium: "PlusJakartaSans_500Medium",
    semibold: "PlusJakartaSans_600SemiBold",
    bold: "PlusJakartaSans_700Bold",
    extrabold: "PlusJakartaSans_800ExtraBold",
  } as const;