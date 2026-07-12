// debugLog.ts
type StringifyFn = (value: unknown) => string;

interface DebugLogOptions {
  /** General label for grouping logs (optional) */
  prefix?: string;
  /** Custom stringify (defaults to JSON.stringify or String) */
  stringify?: StringifyFn;
  /** Global flag to enable/disable logs */
  enabled?: boolean;
}

/**
 * Stores the last logged value by "key" and only logs again if it changed.
 */
const lastValues = new Map<string, string>();

export function debugLogChanged(key: string, value: unknown = "", options: DebugLogOptions = {}) {
  const { prefix = "[DEBUG]", stringify, enabled = true } = options;

  if (!enabled) return;

  // How we transform the value to string for comparison:
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
    // It didn't change, don't log anything.
    return;
  }

  // Save the new value
  lastValues.set(key, repr);

  // Log with clear before/after info
  if (last === undefined) {
    console.log(`${prefix} [${key}] =`, value);
  } else {
    console.log(`${prefix} [${key}] changed:`, { before: last, now: value });
  }
}

/**
 * If you want to clear the history (e.g. when changing scenes)
 */
export function debugLogReset() {
  lastValues.clear();
}
