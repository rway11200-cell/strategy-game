#!/usr/bin/env node
/**
 * generate-version-json.mjs
 * Genera public/version.json con metadatos del deploy.
 * Se ejecuta al inicio del servidor (vite dev).
 */
import { writeFileSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function getCommitSha() {
  let sha = process.env.RAILWAY_GIT_COMMIT_SHA || "";
  if (sha) return sha;

  try {
    const gitHead = resolve(projectRoot, ".git", "HEAD");
    if (existsSync(gitHead)) {
      const ref = readFileSync(gitHead, "utf-8").trim();
      if (ref.startsWith("ref: ")) {
        const refPath = resolve(projectRoot, ".git", ref.slice(5));
        if (existsSync(refPath)) {
          return readFileSync(refPath, "utf-8").trim();
        }
      } else {
        return ref;
      }
    }
  } catch {}
  return "unknown";
}

function main() {
  const payload = {
    name: "strategy-game",
    version: process.env.npm_package_version || "0.0.0",
    commit: getCommitSha(),
    buildTime: new Date().toISOString(),
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || "development",
    railwayProject: process.env.RAILWAY_PROJECT_NAME || "",
    railwayService: process.env.RAILWAY_SERVICE_NAME || "",
  };

  const outDir = resolve(projectRoot, "public");
  const outPath = resolve(outDir, "version.json");

  // Asegurar que public/ existe
  try {
    writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
    console.log("[version-json] Generado:", outPath, JSON.stringify(payload));
  } catch (err) {
    console.error("[version-json] Error:", err.message);
    process.exit(0); // Non-fatal: no romper el startup
  }
}

main();
