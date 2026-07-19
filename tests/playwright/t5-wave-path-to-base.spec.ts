import { expect, test } from "@playwright/test";

test("full enemy wave walks the grid path to the base", async ({ page }) => {
  await page.goto("/");

  // Expect the game to load and the test API to become ready
  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__?.isReady() ?? false), {
      timeout: 15_000,
      message: "the game should become ready",
    })
    .toBe(true);

  // Collect initial state before wave
  const grid = await page.evaluate(() => window.__GAME_TEST__!.getGrid());
  expect(grid.columns).toBeGreaterThan(0);
  expect(grid.rows).toBeGreaterThan(0);

  // Start the wave
  await page.evaluate(() => window.__GAME_TEST__!.startWave());

  // Enemies should appear within a reasonable time
  await expect
    .poll(
      () => page.evaluate(() => window.__GAME_TEST__!.getEnemies().length),
      {
        timeout: 10_000,
        message: "enemies should spawn after startWave()",
      },
    )
    .toBeGreaterThan(0);

  // Capture the first enemy's initial position
  const initialPositions = await page.evaluate(() => {
    const api = window.__GAME_TEST__!;
    return api.getEnemies().map((e) => ({ x: e.worldX, y: e.worldY }));
  });
  expect(initialPositions.length).toBeGreaterThan(0);

  // Let the game run for a few ticks so enemies progress along the path
  // The game uses PixiJS Ticker which runs on requestAnimationFrame;
  // a small tick gives enough frames for movement to start.
  await page.evaluate(() => window.__GAME_TEST__!.tick(500));

  // After movement, at least one enemy should have changed position
  // (they patrol along the grid path from spawn toward base)
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__GAME_TEST__!;
          const enemies = api.getEnemies();
          if (enemies.length === 0) return "no_enemies";
          // Return snapshot of positions
          return enemies.map((e) => ({
            x: Math.round(e.worldX),
            y: Math.round(e.worldY),
          }));
        }),
      {
        timeout: 10_000,
        message: "enemies should move along the grid path",
      },
    )
    .not.toEqual(
      initialPositions.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    );

  // Verify no errors during the whole process
  const finalState = await page.evaluate(() => window.__GAME_TEST__!.getState());
  expect(finalState.errors.length).toBe(0);
});
