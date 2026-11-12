// theme/alpha.ts
// Equivalente às classes Tailwind com opacidade (ex.: bg-warning-soft/60, border-primary/30).

export function withAlpha(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }