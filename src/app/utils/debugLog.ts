// debugLog.ts
type StringifyFn = (value: unknown) => string;

interface DebugLogOptions {
  /** Etiqueta general para agrupar logs (opcional) */
  prefix?: string;
  /** Custom stringify (por defecto JSON.stringify o String) */
  stringify?: StringifyFn;
  /** Flag global para encender/apagar logs */
  enabled?: boolean;
}

/**
 * Guarda el último valor logueado por "key" y solo vuelve a loguear si cambió.
 */
const lastValues = new Map<string, string>();

export function debugLogChanged(key: string, value: unknown, options: DebugLogOptions = {}) {
  const { prefix = "[DEBUG]", stringify, enabled = true } = options;

  if (!enabled) return;

  // Cómo transformamos el valor a string para comparar:
  let repr: string;
  if (stringify) {
    repr = stringify(value);
  } else if (typeof value === "object") {
    try {
      repr = JSON.stringify(value);
    } catch {
      repr = String(value);
    }
  } else {
    repr = String(value);
  }

  const last = lastValues.get(key);
  if (last === repr) {
    // No cambió, no logueamos nada.
    return;
  }

  // Guardamos el nuevo valor
  lastValues.set(key, repr);

  // Hacemos el log con info clara de antes/después si quieres
  if (last === undefined) {
    console.log(`${prefix} [${key}] =`, value);
  } else {
    console.log(`${prefix} [${key}] cambió:`, { antes: last, ahora: value });
  }
}

/**
 * Si quieres limpiar el historial (por ejemplo al cambiar de escena)
 */
export function debugLogReset() {
  lastValues.clear();
}
