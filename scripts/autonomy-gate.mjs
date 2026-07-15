#!/usr/bin/env node

/**
 * autonomy-gate.mjs — Gate sin IA que decide si hay trabajo accionable.
 *
 * Lee el resultado del monitor (monitor-railway.mjs) y decide:
 *
 * - NO_ACTION: no hay fallos nuevos, no hay tareas ready
 * - NEW_FAILURE: hay fingerprint nuevo no registrado → accionable
 * - DUPLICATE_FAILURE: fallo ya conocido → actualizar contador, no accionar
 * - READY_TASK: hay tarea kanban lista (placeholder)
 *
 * Uso: node scripts/autonomy-gate.mjs [--monitor-output <json> | --monitor-file <path>]
 *   o leer de stdin si se pipea desde el monitor.
 *
 * Output: una línea con la decisión + JSON detallado.
 */

import { readFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const STATE_DIR = join(PROJECT_ROOT, ".autonomy");
const STATE_FILE = join(STATE_DIR, "monitor-state.json");

// ──────────────────────────────────────────
// Estado
// ──────────────────────────────────────────
function loadState() {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    } catch { /* ignorar */ }
  }
  return null;
}

// ──────────────────────────────────────────
// Integración Kanban (placeholder)
// ──────────────────────────────────────────
function hasReadyTask() {
  // Placeholder: en el futuro leerá kanban board vía Hermes API.
  // Por ahora, siempre false.
  return false;
}

// ──────────────────────────────────────────
// Invocación IA (placeholder)
// ──────────────────────────────────────────
function invokeAiTriage(failure) {
  // Placeholder: invocar Hermes con el fingerprint para análisis.
  // Implementar en fase 2.
  return { invoked: false, reason: "PLACEHOLDER — triage IA no implementado todavía" };
}

function invokeAiWorker(task) {
  // Placeholder: invocar Hermes para ejecutar una tarea.
  // Implementar en fase 2.
  return { invoked: false, reason: "PLACEHOLDER — worker IA no implementado todavía" };
}

// ──────────────────────────────────────────
// Decisión
// ──────────────────────────────────────────
async function main() {
  // Leer resultado del monitor
  let monitorResult = null;

  // 1. Si viene por flag --monitor-file
  const monitorFileIdx = process.argv.indexOf("--monitor-file");
  if (monitorFileIdx >= 0 && process.argv[monitorFileIdx + 1]) {
    const path = process.argv[monitorFileIdx + 1];
    if (existsSync(path)) {
      monitorResult = JSON.parse(readFileSync(path, "utf-8"));
    }
  }

  // 2. Si viene por flag --monitor-output
  const monitorOutputIdx = process.argv.indexOf("--monitor-output");
  if (monitorOutputIdx >= 0 && process.argv[monitorOutputIdx + 1]) {
    monitorResult = JSON.parse(process.argv[monitorOutputIdx + 1]);
  }

  // 3. Si viene por stdin (pipe)
  if (!monitorResult && !process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const stdinData = Buffer.concat(chunks).toString().trim();
    if (stdinData) {
      try {
        monitorResult = JSON.parse(stdinData);
      } catch {
        // no era JSON válido
      }
    }
  }

  if (!monitorResult) {
    const decision = {
      decision: "NO_INPUT",
      reason: "No se recibió resultado del monitor. Pasar --monitor-file o pipe desde monitor.",
    };
    process.stdout.write(decision.decision + "\n");
    process.stdout.write(JSON.stringify(decision, null, 2) + "\n");
    process.exit(0);
  }

  const state = loadState();
  const result = {
    timestamp: new Date().toISOString(),
    monitorStatus: monitorResult.status,
    monitorFingerprints: monitorResult.fingerprints || [],
    newFailure: false,
    hasReadyTask: false,
  };

  // ── Decisión ──

  // 1. Si el monitor reporta fallo nuevo (fingerprint no visto antes)
  if (monitorResult.status === "fail" && monitorResult.newFailure) {
    result.decision = "NEW_FAILURE";
    result.newFailure = true;
    result.fingerprints = monitorResult.fingerprints;
    result.trigger = "Nuevo fingerprint detectado";
    result.aiTriage = invokeAiTriage(monitorResult);

  // 2. Si el monitor reporta fallo pero es conocido
  } else if (monitorResult.status === "fail") {
    result.decision = "DUPLICATE_FAILURE";
    result.newFailure = false;
    result.fingerprints = monitorResult.fingerprints;
    result.trigger = "Fallo ya conocido, conteo incrementado";
    if (state) {
      result.repeatCount = state.repeatCount;
    }

  // 3. Si hay tarea ready en kanban
  } else if (hasReadyTask()) {
    result.decision = "READY_TASK";
    result.hasReadyTask = true;
    result.trigger = "Tarea kanban lista para ejecutar";
    result.aiWorker = invokeAiWorker({});

  // 4. Nada que hacer
  } else {
    result.decision = "NO_ACTION";
    result.trigger = "Sin fallos nuevos ni tareas ready";
  }

  result.explanation = getExplanation(result.decision);

  process.stdout.write(result.decision + "\n");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

function getExplanation(decision) {
  const map = {
    NO_ACTION: "No hay fallos nuevos. No hay tareas ready. No se invoca IA. Silencio.",
    NEW_FAILURE: "Fallo nuevo detectado. Se invoca triage IA para análisis y creación de tarea.",
    DUPLICATE_FAILURE: "Fallo ya conocido y registrado. Solo se actualiza contador. Sin acción de IA.",
    READY_TASK: "Tarea kanban lista para ejecutar. Se invoca worker IA.",
    NO_INPUT: "No se pudo leer resultado del monitor.",
  };
  return map[decision] || "Decisión desconocida";
}

main().catch((err) => {
  const result = {
    decision: "ERROR",
    error: err.message,
  };
  process.stdout.write(result.decision + "\n");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(0);
});
