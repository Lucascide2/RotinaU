// components/time-field.web.tsx
// Versão web: só o seletor do navegador altera o valor (sem digitação nos segmentos).
import { colors, fonts, radius } from "../theme/colors";

export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const openPicker = (el: HTMLInputElement) => {
    try {
      el.showPicker();
    } catch {
      // Navegador sem suporte: veja a observação abaixo.
    }
  };

  return (
    <input
      type="time"
      value={value}
      step={900}
      onClick={(e) => openPicker(e.currentTarget)}
      onKeyDown={(e) => {
        // Libera Tab (navegação) e Escape (fechar o seletor); bloqueia o resto.
        if (e.key === "Tab" || e.key === "Escape") return;

        // Enter e Espaço abrem o seletor, como num botão.
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker(e.currentTarget);
          return;
        }

        e.preventDefault(); // bloqueia números, setas, Backspace, etc.
      }}
      onPaste={(e) => e.preventDefault()}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
      style={{
        borderRadius: radius.md,
        backgroundColor: colors.primarySoft,
        color: colors.primary,
        fontFamily: fonts.medium,
        fontSize: 14,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        border: "none",
        outline: "none",
        cursor: "pointer",
        caretColor: "transparent", // esconde o cursor de texto nos segmentos
        userSelect: "none",
      }}
    />
  );
}