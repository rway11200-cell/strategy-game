import { readFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const requiredPages = [
  {
    path: "index.html",
    marker: 'data-testid="game-root"',
  },
  {
    path: "__test__/gameplay/index.html",
    marker: 'data-harness="strategy-game-playwright"',
  },
  {
    path: "__test__/grid-renderer/index.html",
    marker: 'data-harness="strategy-game-grid-playwright"',
  },
];

const violations = [];
for (const required of requiredPages) {
  try {
    const contents = await readFile(path.join(distDir, required.path), "utf8");
    if (!contents.includes(required.marker)) {
      violations.push(`${required.path} does not contain ${JSON.stringify(required.marker)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    violations.push(`${required.path} is missing or unreadable: ${message}`);
  }
}

if (violations.length > 0) {
  throw new Error(`Deployment artifact is incomplete:\n${violations.join("\n")}`);
}

process.stdout.write("[deployment-artifact] Main game and playground routes are present.\n");
