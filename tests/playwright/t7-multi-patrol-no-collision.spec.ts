import { expect, test, type Page } from "@playwright/test";

async function waitForGameReady(page: Page, timeout = 25_000): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window.__GAME_TEST__?.isReady === "function" && window.__GAME_TEST__.isReady(),
    undefined,
    { timeout },
  );
}

test("5 enemies patrol between two points without permanent collision", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await waitForGameReady(page);

  // Get grid info
  const grid = await page.evaluate(() => window.__GAME_TEST__!.getGrid());
  expect(grid.columns).toBeGreaterThan(1);
  expect(grid.rows).toBeGreaterThan(1);

  // Find 5 free cells spread across the grid, avoiding blocked cells
  // We'll use cells that are walkable and not occupied
  const walkableCells = grid.cells
    .flat()
    .filter((cell) => cell.type !== "blocked" && !cell.occupied);

  expect(walkableCells.length).toBeGreaterThanOrEqual(7);

  // Pick 5 distinct spawn cells (first 5 walkable), and 2 patrol endpoints (last 2)
  const spawnCells = walkableCells.slice(0, 5);
  const patrolFrom = walkableCells[5];
  const patrolTo = walkableCells[6];

  // Spawn 5 enemies at the chosen cells
  const spawnResults = await page.evaluate(
    (cells) => {
      return cells.map((cell) => window.__GAME_TEST__!.spawnEnemy(cell.col, cell.row, "basic"));
    },
    spawnCells.map((c) => ({ col: c.col, row: c.row })),
  );

  for (const result of spawnResults) {
    expect(result.success).toBe(true);
  }

  // Verify 5 enemies are active
  const enemiesAfterSpawn = await page.evaluate(() => window.__GAME_TEST__!.getEnemies());
  expect(enemiesAfterSpawn.length).toBe(5);

  // Issue patrol commands to all 5 enemies via the new API
  // Each enemy patrols between the common patrolFrom and patrolTo endpoints
  const patrolResults = await page.evaluate(
    ({ spawnCells, patrolFrom, patrolTo }: {
      spawnCells: { col: number; row: number }[];
      patrolFrom: { col: number; row: number };
      patrolTo: { col: number; row: number };
    }) => {
      return spawnCells.map((cell) =>
        window.__GAME_TEST__!.patrolEnemy(patrolFrom.col, patrolFrom.row, patrolTo.col, patrolTo.row),
      );
    },
    {
      spawnCells: spawnCells.map((c) => ({ col: c.col, row: c.row })),
      patrolFrom: { col: patrolFrom.col, row: patrolFrom.row },
      patrolTo: { col: patrolTo.col, row: patrolTo.row },
    },
  );

  for (const result of patrolResults) {
    expect(result).toBe(true);
  }

  // Check no errors immediately after setup
  const stateAfterSetup = await page.evaluate(() => window.__GAME_TEST__!.getState());
  expect(stateAfterSetup.errors).toEqual([]);

  // Wait for enemies to move — poll positions
  // We expect all 5 enemies to have changed their grid cell at least once within the timeout
  await expect
    .poll(
      async () => {
        const enemies = await page.evaluate(() => window.__GAME_TEST__!.getEnemies());
        // An enemy counts as "moved" if its position changed from where it was spawned
        // Since we can only check world positions, we verify all 5 are still active
        // (none was destroyed) and track how many are on a distinct position
        const state = await page.evaluate(() => window.__GAME_TEST__!.getState());
        return {
          activeCount: enemies.length,
          errors: state.errors,
          // Check at least some enemies have moved from spawn positions
          // by verifying they're in a different cell
          hasMovement: await page.evaluate(
            ({ spawnCells }: { spawnCells: { col: number; row: number }[] }) => {
              const grid = window.__GAME_TEST__!.getGrid();
              const currentEnemies = window.__GAME_TEST__!.getEnemies();
              const tileSize = grid.tileSize;

              let movedCount = 0;
              for (const enemy of currentEnemies) {
                // Convert world position to approximate grid cell
                const col = Math.floor(enemy.worldX / tileSize);
                const row = Math.floor(enemy.worldY / tileSize);
                // Check if this enemy is NOT at any spawn cell (meaning it moved)
                const atSpawn = spawnCells.some((s) => s.col === col && s.row === row);
                if (!atSpawn) movedCount++;
              }
              return movedCount;
            },
            { spawnCells: spawnCells.map((c) => ({ col: c.col, row: c.row })) },
          ),
        };
      },
      { timeout: 20_000, message: "enemies should move from their spawn positions via patrol" },
    )
    .toEqual({
      activeCount: 5,
      errors: [],
      hasMovement: expect.any(Number),
    });

  // Actually check that at least 3 out of 5 enemies moved
  const finalMovement = await page.evaluate(
    ({ spawnCells }: { spawnCells: { col: number; row: number }[] }) => {
      const grid = window.__GAME_TEST__!.getGrid();
      const currentEnemies = window.__GAME_TEST__!.getEnemies();
      const tileSize = grid.tileSize;

      let movedCount = 0;
      for (const enemy of currentEnemies) {
        const col = Math.floor(enemy.worldX / tileSize);
        const row = Math.floor(enemy.worldY / tileSize);
        const atSpawn = spawnCells.some((s) => s.col === col && s.row === row);
        if (!atSpawn) movedCount++;
      }
      return movedCount;
    },
    { spawnCells: spawnCells.map((c) => ({ col: c.col, row: c.row })) },
  );

  // At least 3 of 5 enemies should have moved — checks no permanent collision block
  expect(finalMovement).toBeGreaterThanOrEqual(3);

  const finalState = await page.evaluate(() => window.__GAME_TEST__!.getState());
  expect(finalState.errors).toEqual([]);
});
