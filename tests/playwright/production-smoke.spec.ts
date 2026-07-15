import { expect, test } from "@playwright/test";

test("deployed game passes the production smoke checks", async ({ page, request }) => {
  const productionUrl = process.env.PRODUCTION_URL;
  const expectedCommit = process.env.EXPECTED_COMMIT_SHA;

  expect(productionUrl, "PRODUCTION_URL must be configured").toBeTruthy();
  expect(expectedCommit, "EXPECTED_COMMIT_SHA must be configured").toBeTruthy();

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(`pageerror: ${error.message}`);
  });

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response, "the application did not return a document response").not.toBeNull();
  expect(response!.ok(), `the application returned HTTP ${response!.status()}`).toBe(true);

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  await page.waitForFunction(
    () =>
      typeof window.__GAME_TEST__?.isReady === "function" &&
      window.__GAME_TEST__.isReady() === true,
    undefined,
    { timeout: 30_000 },
  );

  const apiCheck = await page.evaluate(() => {
    const api = window.__GAME_TEST__;
    if (!api) return { exists: false, ready: false, serializedState: null };

    const serializedState = JSON.stringify(api.getState());
    JSON.parse(serializedState);
    return { exists: true, ready: api.isReady(), serializedState };
  });

  expect(apiCheck.exists).toBe(true);
  expect(apiCheck.ready).toBe(true);
  expect(apiCheck.serializedState).not.toBeNull();

  const versionResponse = await request.get("/version.json", {
    headers: { "cache-control": "no-cache" },
  });
  expect(versionResponse.ok()).toBe(true);

  const version: unknown = await versionResponse.json();
  expect(version).toEqual(
    expect.objectContaining({
      name: "strategy-game",
      version: expect.any(String),
      commit: expectedCommit,
      buildTime: expect.any(String),
    }),
  );
  expect(Number.isNaN(Date.parse((version as { buildTime: string }).buildTime))).toBe(false);

  expect(consoleErrors, `critical browser errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});
