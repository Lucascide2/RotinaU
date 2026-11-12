// lib/error-reporting.ts
type ErrorContext = { boundary?: string };

export function reportError(error: unknown, context: ErrorContext = {}) {
  // Ponto único para integrar Sentry/Crashlytics no futuro.
  console.error("[RotinaU]", context.boundary ?? "unknown", error);
}

let installed = false;

/**
 * Captura exceções JS não tratadas fora do React (timers, callbacks, promises).
 * O ErrorBoundary só pega erros durante a renderização.
 */
export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;

  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { boundary: isFatal ? "global_fatal" : "global_error" });
    defaultHandler(error, isFatal);
  });
}