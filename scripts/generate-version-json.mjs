/**
 * Vite plugin: generate-version-json
 * Genera /version.json durante el build con metadatos del deploy.
 * Se sirve como archivo estático en producción.
 */
import { writeFileSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function generateVersionJson() {
  let commitSha = process.env.RAILWAY_GIT_COMMIT_SHA || "";

  // Fallback: leer .git/HEAD si no hay env
  if (!commitSha) {
    const gitHead = resolve(__dirname, "..", ".git", "HEAD");
    if (existsSync(gitHead)) {
      const ref = readFileSync(gitHead, "utf-8").trim();
      if (ref.startsWith("ref: ")) {
        const refPath = resolve(__dirname, "..", ".git", ref.slice(5));
        if (existsSync(refPath)) {
          commitSha = readFileSync(refPath, "utf-8").trim();
        }
      } else {
        commitSha = ref;
      }
    }
  }

  return {
    name: "generate-version-json",
    closeBundle() {
      const outDir = resolve(__dirname, "..", "dist");
      const version = process.env.npm_package_version || "0.0.0";
      const payload = {
        name: "strategy-game",
        version,
        commit: commitSha || "unknown",
        buildTime: new Date().toISOString(),
        environment: process.env.RAILWAY_ENVIRONMENT_NAME || "production",
        railwayProject: process.env.RAILWAY_PROJECT_NAME || "",
        railwayService: process.env.RAILWAY_SERVICE_NAME || "",
      };
      const outPath = resolve(outDir, "version.json");
      writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
      console.log(`[version-json] Escrito ${outPath}`);
    },
  };
}
