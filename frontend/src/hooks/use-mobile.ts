// hooks/use-mobile.ts
import { useWindowDimensions } from "react-native";

const MOBILE_BREAKPOINT = 768;

/**
 * No app nativo quase sempre retorna true (celular).
 * Retorna false em tablets/iPads em modo paisagem ou em telas largas,
 * mantendo o mesmo breakpoint de 768 do projeto web.
 */
export function useIsMobile(): boolean {
  const { width } = useWindowDimensions();
  return width < MOBILE_BREAKPOINT;
}