#!/usr/bin/env node

/**
 * monitor-railway.mjs — Monitor sin IA para Railway.
 *
 * Valida que el deploy en Railway responda correctamente:
 *  - HTTP 200 en /
 *  - version.json existe y es válido
 *  - Assets principales no dan 404
 *
 * Uso: node scripts/monitor-railway.mjs
 * ENV: RAILWAY_APP_URL (obligatorio)
 *
 * Output: JSON a stdout con resultado + fingerprint si falla.
 * Estado: escribe en .autonomy/monitor-state.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const STATE_DIR = join(PROJECT_ROOT, ".autonomy");
const STATE_FILE = join(STATE_DIR, "monitor-state.json");
const LOCK_FILE = join(STATE_DIR, "monitor.lock");
const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

// ──────────────────────────────────────────
// Lock
// ──────────────────────────────────────────
function acquireLock() {
  mkdirSync(STATE_DIR, { recursive: true });
  if (existsSync(LOCK_FILE)) {
    const mtime = readFileSync(LOCK_FILE, "utf-8").trim();
    const age = Date.now() - new Date(mtime).getTime();
    if (age < LOCK_TIMEOUT_MS) {
      console.error(JSON.stringify({ error: "LOCK_EXISTS", age_ms: age }));
      process.exit(0); // Salir sin error para no triggerear falsas alarmas
    }
    // Lock expirado — continuar
  }
  writeFileSync(LOCK_FILE, new Date().toISOString());
}

function releaseLock() {
  try {
    writeFileSync(LOCK_FILE, "");
  } catch { /* ignorar */ }
}

// ──────────────────────────────────────────
// Estado
// ──────────────────────────────────────────
function loadState() {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    } catch {
      // archivo corrupto, empezar fresh
    }
  }
  return {
    lastRun: null,
    lastStatus: null, // "ok" | "fail"
    lastFingerprint: null,
    openFingerprints: [], // { fingerprint, firstSeen, lastSeen, count, resolved }
    repeatCount: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastVersion: null,
    lastCommit: null,
  };
}

function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

// ──────────────────────────────────────────
// Fingerprint
// ──────────────────────────────────────────
function makeFingerprint(category, label) {
  // Normalizado: railway:prod:<category>:<label>
  // Sin caracteres raros, lowercase, sin espacios
  const norm = (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `railway:prod:${norm(category)}:${norm(label)}`;
}

function isDuplicate(state, fingerprint) {
  return state.openFingerprints.some(
    (f) => f.fingerprint === fingerprint && !f.resolved
  );
}

function registerFingerprint(state, fingerprint) {
  const existing = state.openFingerprints.find(
    (f) => f.fingerprint === fingerprint
  );
  if (existing) {
    existing.lastSeen = new Date().toISOString();
    existing.count = (existing.count || 1) + 1;
  } else {
    state.openFingerprints.push({
      fingerprint,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      count: 1,
      resolved: false,
    });
  }
}

// ──────────────────────────────────────────
// Monitoreo
// ──────────────────────────────────────────
async function main() {
  acquireLock();

  const APP_URL = process.env.RAILWAY_APP_URL || "https://strategy-game-production-0277.up.railway.app";
  const baseUrl = APP_URL.replace(/\/+$/, "");

  const state = loadState();
  const result = {
    timestamp: new Date().toISOString(),
    url: baseUrl,
    status: "ok",
    checks: {},
    fingerprints: [],
    newFailure: false,
  };

  try {
    // ── Check 1: HTTP 200 en home ──
    const homeRes = await fetch(baseUrl, { signal: AbortSignal.timeout(15000) });
    const homeOk = homeRes.status === 200;
    result.checks.home = { status: homeRes.status, ok: homeOk };
    if (!homeOk) {
      const fp = makeFingerprint("home", `http-${homeRes.status}`);
      result.fingerprints.push(fp);
      result.status = "fail";
    }

    // ── Check 2: version.json ──
    const versionUrl = `${baseUrl}/version.json`;
    const versionRes = await fetch(versionUrl, { signal: AbortSignal.timeout(10000) });
    if (versionRes.status === 200) {
      const vData = await versionRes.json();
      result.checks.version = {
        status: versionRes.status,
        ok: true,
        version: vData.version,
        commit: vData.commit,
        buildTime: vData.buildTime,
      };
      state.lastVersion = vData.version;
      state.lastCommit = vData.commit;
    } else {
      result.checks.version = { status: versionRes.status, ok: false };
      const fp = makeFingerprint("version", versionRes.status === 404 ? "missing" : `http-${versionRes.status}`);
      result.fingerprints.push(fp);
      result.status = "fail";
    }

    // ── Check 3: Assets principales (detectar desde index.html) ──
    const html = await (await fetch(baseUrl, { signal: AbortSignal.timeout(10000) })).text();
    const assetPattern = /(src|href)=["']([^"']+\.(js|css))["']/g;
    let match;
    const assetUrls = [];
    while ((match = assetPattern.exec(html)) !== null) {
      const assetPath = match[2];
      if (!assetPath.startsWith("http")) {
        assetUrls.push(new URL(assetPath, baseUrl).href);
      }
    }
    // Limitar a ~10 assets únicos para no saturar
    const uniqueAssets = [...new Set(assetUrls)].slice(0, 10);
    const assetResults = [];
    for (const assetUrl of uniqueAssets) {
      try {
        const assetRes = await fetch(assetUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(8000),
        });
        assetResults.push({ url: assetUrl, status: assetRes.status, ok: assetRes.status < 400 });
        if (assetRes.status >= 400) {
          const assetName = assetUrl.split("/").pop() || "unknown";
          const fp = makeFingerprint("assets", `${assetName}-${assetRes.status}`);
          result.fingerprints.push(fp);
          result.status = "fail";
        }
      } catch (err) {
        assetResults.push({ url: assetUrl, error: err.message, ok: false });
        const assetName = assetUrl.split("/").pop() || "unknown";
        const fp = makeFingerprint("assets", `${assetName}-timeout`);
        result.fingerprints.push(fp);
        result.status = "fail";
      }
    }
    result.checks.assets = assetResults;

    // ── Check 4 (opcional): window.__GAME_TEST__ vía fetch no puede,
    //    pero verificamos que el HTML tenga el div del juego ──
    const hasCanvas = html.includes("pixi") || html.includes("canvas") || html.includes("game");
    result.checks.gameSkeleton = {
      ok: hasCanvas,
      hint: hasCanvas ? "HTML contiene pixi/canvas/game" : "No se detecta contenedor del juego",
    };
    if (!hasCanvas) {
      const fp = makeFingerprint("game", "skeleton-missing");
      result.fingerprints.push(fp);
      result.status = "fail";
    }
  } catch (err) {
    result.status = "fail";
    result.error = err.message;
    const fp = makeFingerprint("network", err.name === "TimeoutError" ? "timeout" : "fetch-error");
    result.fingerprints.push(fp);
  }

  // ── Deduplicar y actualizar estado ──
  result.newFailure = false;
  if (result.status === "fail") {
    const uniqueFps = [...new Set(result.fingerprints)];
    result.fingerprints = uniqueFps;
    result.newFailure = uniqueFps.some((fp) => !isDuplicate(state, fp));
    for (const fp of uniqueFps) {
      registerFingerprint(state, fp);
    }
  }

  // ── Actualizar estado ──
  state.lastRun = result.timestamp;
  state.lastStatus = result.status;
  if (result.status === "ok") {
    state.lastSuccessAt = result.timestamp;
    state.repeatCount = 0;
  } else {
    state.lastFailureAt = result.timestamp;
    state.repeatCount = (state.repeatCount || 0) + 1;
  }
  state.lastFingerprint = result.fingerprints.join("|") || null;
  saveState(state);

  // ── Output ──
  result.stateSummary = {
    lastRun: state.lastRun,
    lastStatus: state.lastStatus,
    openFingerprints: state.openFingerprints.length,
    repeatCount: state.repeatCount,
    lastVersion: state.lastVersion,
    lastCommit: state.lastCommit,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  releaseLock();
  process.exit(result.status === "ok" ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ error: "UNCAUGHT", message: err.message }));
  releaseLock();
  process.exit(2);
});
