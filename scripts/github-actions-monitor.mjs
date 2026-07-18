#!/usr/bin/env node

/**
 * github-actions-monitor.mjs
 *
 * Lee el último workflow run de GitHub Actions del repo strategy-game.
 * Si hay un fallo NUEVO, lo registra en Nexo como run log y notifica.
 * Si es fallo repetido, silencio.
 *
 * ENV:
 *   GH_TOKEN — GitHub PAT (obligatorio)
 *   NEXO_KEY — API Key de Nexo (obligatorio)
 *   NEXO_URL — URL base de Nexo (default: https://nexo-production-fa29.up.railway.app)
 *   GAMEREPO — "rway11200-cell/strategy-game" (default)
 *   STATE_DIR — dónde guardar estado (default: .autonomy)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const STATE_DIR = process.env.STATE_DIR || join(PROJECT_ROOT, ".autonomy");
const STATE_FILE = join(STATE_DIR, "github-actions-state.json");
const LOCK_FILE = join(STATE_DIR, "github-actions-monitor.lock");
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

const GH_TOKEN = process.env.GH_TOKEN;
const NEXO_KEY = process.env.NEXO_KEY || "";
const NEXO_URL = process.env.NEXO_URL || "https://nexo-production-fa29.up.railway.app";
const REPO = process.env.GAMEREPO || "rway11200-cell/strategy-game";

if (!GH_TOKEN) {
  console.error("Falta GH_TOKEN");
  process.exit(1);
}

const GH_API = "https://api.github.com";
const GH_HEADERS = {
  Authorization: `token ${GH_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "Hermes-Autonomy/1.0",
};
const NEXO_HEADERS = {
  "X-API-Key": NEXO_KEY,
  "Content-Type": "application/json",
};

// ── Lock ──
function acquireLock() {
  mkdirSync(STATE_DIR, { recursive: true });
  if (existsSync(LOCK_FILE)) {
    const mtime = readFileSync(LOCK_FILE, "utf-8").trim();
    const age = Date.now() - new Date(mtime).getTime();
    if (age < LOCK_TIMEOUT_MS) {
      console.error(JSON.stringify({ error: "LOCK_EXISTS", age_ms: age }));
      process.exit(0);
    }
  }
  writeFileSync(LOCK_FILE, new Date().toISOString());
}

function releaseLock() {
  try { writeFileSync(LOCK_FILE, ""); } catch {}
}

// ── Estado ──
function loadState() {
  if (existsSync(STATE_FILE)) {
    try { return JSON.parse(readFileSync(STATE_FILE, "utf-8")); } catch {}
  }
  return { lastRunId: null, lastConclusion: null, lastRunNumber: null, seenFingerprints: [], lastCheckAt: null };
}

function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

// ── Fingerprint ──
const FINGERPRINT_PREFIX = `gh:${REPO.split("/")[1]}`;
function makeFingerprint(run) {
  return `${FINGERPRINT_PREFIX}:run-${run.run_number}:${run.conclusion}`;
}

// ── GitHub API ──
async function ghFetch(path) {
  const url = `${GH_API}${path}`;
  const res = await fetch(url, { headers: GH_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText} for ${path}`);
  return res.json();
}

// ── Nexo API ──
async function checkNexoRunExists(runId) {
  // Buscar si ya existe un run con este run_id en Nexo
  try {
    const url = `${NEXO_URL}/coding-loop/runs?page_size=50`;
    const res = await fetch(url, { headers: NEXO_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return false;
    const data = await res.json();
    const items = data.items || [];
    return items.some((r) => r.run_id === runId);
  } catch {
    return false;
  }
}

async function createNexoRun(runId, status, summary, duration = 0) {
  const url = `${NEXO_URL}/coding-loop/runs`;
  const body = { run_id: runId, status, summary, openai_available: false, duration };
  const res = await fetch(url, {
    method: "POST",
    headers: NEXO_HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nexo API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Main ──
async function main() {
  acquireLock();

  const state = loadState();
  const result = {
    timestamp: new Date().toISOString(),
    repo: REPO,
    decision: "NO_ACTION",
    nexoRunId: null,
    summary: null,
  };

  try {
    // 1. Último workflow run
    const runs = await ghFetch(`/repos/${REPO}/actions/runs?per_page=1`);
    if (!runs.workflow_runs?.length) {
      result.decision = "NO_ACTION";
      saveState(state);
      console.log(result.decision);
      console.log(JSON.stringify(result));
      releaseLock();
      process.exit(0);
    }

    const latest = runs.workflow_runs[0];
    const runId = latest.id;
    const conclusion = latest.conclusion || "unknown";
    const runNumber = latest.run_number;
    const sha = latest.head_sha;
    const title = latest.display_title || "(sin título)";
    const htmlUrl = latest.html_url;

    // 2. Jobs fallidos
    let failedSteps = [];
    if (conclusion === "failure") {
      try {
        const jobs = await ghFetch(`/repos/${REPO}/actions/runs/${runId}/jobs`);
        for (const job of jobs.jobs || []) {
          for (const step of job.steps || []) {
            if (step.conclusion === "failure") {
              failedSteps.push({ job: job.name, step: step.name });
            }
          }
        }
      } catch {
        failedSteps.push({ job: "unknown", step: "no se pudieron leer jobs" });
      }
    }

    const fingerprint = makeFingerprint({ run_number: runNumber, conclusion, sha });

    result.summary = { runId, runNumber, conclusion, sha: sha.slice(0, 8), title, url: htmlUrl, failedSteps };

    // 3. Decidir y registrar en Nexo
    const nexoRunId = `gh-${runNumber}-${sha.slice(0, 7)}`;

    if (conclusion === "failure") {
      const alreadySeen = state.seenFingerprints.includes(fingerprint);
      const nexoExists = await checkNexoRunExists(nexoRunId);

      if (!alreadySeen && !nexoExists) {
        // Fallo NUEVO — registrar en Nexo
        result.decision = "NEW_FAILURE";
        result.nexoRunId = nexoRunId;

        const failedSummary = failedSteps.map((s) => `${s.job}: ${s.step}`).join("; ");
        const runSummary = `❌ GitHub Actions falló — Run #${runNumber}: ${title}. SHA: ${sha.slice(0, 8)}. Pasos fallidos: ${failedSummary}. URL: ${htmlUrl}`;

        await createNexoRun(nexoRunId, "Failed", runSummary, 0);
        state.seenFingerprints.push(fingerprint);

      } else {
        result.decision = "DUPLICATE_FAILURE";
      }
    } else {
      result.decision = "NO_ACTION";
    }

    // 4. Actualizar estado
    state.lastRunId = runId;
    state.lastConclusion = conclusion;
    state.lastRunNumber = runNumber;
    state.lastCheckAt = result.timestamp;
    saveState(state);

  } catch (err) {
    result.decision = "ERROR";
    result.error = err.message;
  }

  console.log(result.decision);
  console.log(JSON.stringify(result, null, 2));
  releaseLock();
  process.exit(result.decision === "ERROR" ? 1 : 0);
}

main().catch((err) => {
  console.error(JSON.stringify({ error: "UNCAUGHT", message: err.message }));
  releaseLock();
  process.exit(2);
});
