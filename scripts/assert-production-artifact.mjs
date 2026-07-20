import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map"]);
const forbiddenMarkers = [
  "__GAME_TEST__",
  "__GRID_VISUAL_TEST__",
  "/__test__/",
  "strategy-game-playwright",
  "GameTestApi.",
  "GridVisualTestApi.",
];

async function collectTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectTextFiles(entryPath)));
    else if (textExtensions.has(path.extname(entry.name))) files.push(entryPath);
  }
  return files;
}

const violations = [];
for (const file of await collectTextFiles(distDir)) {
  const contents = await readFile(file, "utf8");
  for (const marker of forbiddenMarkers) {
    if (contents.includes(marker)) {
      violations.push(`${path.relative(distDir, file)} contains ${JSON.stringify(marker)}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Production artifact contains test harness code:\n${violations.join("\n")}`);
}

process.stdout.write("[production-artifact] No test harness markers found in dist.\n");
