#!/usr/bin/env node

const productionUrl = process.env.PRODUCTION_URL;
const expectedCommit = process.env.EXPECTED_COMMIT_SHA;
const timeoutMs = Number(process.env.PRODUCTION_WAIT_TIMEOUT_MS ?? 10 * 60 * 1000);
const pollIntervalMs = Number(process.env.PRODUCTION_POLL_INTERVAL_MS ?? 10_000);

if (!productionUrl) {
  throw new Error("PRODUCTION_URL is required");
}

if (!expectedCommit) {
  throw new Error("EXPECTED_COMMIT_SHA is required");
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error("PRODUCTION_WAIT_TIMEOUT_MS must be a positive number");
}

if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
  throw new Error("PRODUCTION_POLL_INTERVAL_MS must be a positive number");
}

const versionUrl = new URL("version.json", `${productionUrl.replace(/\/+$/, "")}/`);
const deadline = Date.now() + timeoutMs;
let attempt = 0;
let lastResult = "no response received";

while (Date.now() < deadline) {
  attempt += 1;

  try {
    const response = await fetch(versionUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(15_000, pollIntervalMs)),
    });

    if (!response.ok) {
      lastResult = `HTTP ${response.status} ${response.statusText}`;
    } else {
      const version = await response.json();
      lastResult = `deployed commit ${JSON.stringify(version.commit)}`;

      if (version.commit === expectedCommit) {
        console.log(
          `Production is ready at ${versionUrl} with commit ${expectedCommit} (attempt ${attempt}).`,
        );
        process.exit(0);
      }
    }
  } catch (error) {
    lastResult = error instanceof Error ? error.message : String(error);
  }

  const remainingMs = deadline - Date.now();
  if (remainingMs > 0) {
    console.log(
      `Waiting for commit ${expectedCommit} at ${versionUrl} (attempt ${attempt}; ${lastResult}).`,
    );
    await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, remainingMs)));
  }
}

throw new Error(
  `Timed out after ${timeoutMs}ms waiting for commit ${expectedCommit} at ${versionUrl}; last result: ${lastResult}`,
);
