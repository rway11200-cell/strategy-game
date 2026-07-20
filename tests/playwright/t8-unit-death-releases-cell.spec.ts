import { expect, test } from "@playwright/test";

test("a unit killed by damage is removed from the grid", async ({ page }) => {
  await page.goto("/");

  // Wait for the game to be ready
  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__?.isReady() ?? false), {
      timeout: 15_000,
      message: "the game should become ready",
    })
    .toBe(true);

  // Verify the new API methods are available
  const supportsUnitDeath = await page.evaluate(() => {
    const api = window.__GAME_TEST__!;
    return typeof api.getUnits === "function" && typeof api.damageUnit === "function";
  });
  expect(supportsUnitDeath, "GameTestApi must expose getUnits and damageUnit methods").toBe(true);

  // Find a free cell to spawn the enemy
  const freeCell = await page.evaluate(() => {
    const api = window.__GAME_TEST__!;
    const grid = api.getGrid();
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.columns; col++) {
        const cell = grid.cells[row][col];
        if (cell.type !== "blocked" && !cell.occupied) {
          return { col, row };
        }
      }
    }
    return null;
  });
  expect(freeCell, "there should be a free cell on the grid").not.toBeNull();

  // Spawn an enemy at the free cell (use "basic" which is Goblin with 50 HP)
  const spawnResult = await page.evaluate((cell) => {
    const api = window.__GAME_TEST__!;
    return api.spawnEnemy(cell.col, cell.row, "basic");
  }, freeCell);

  expect(spawnResult.success, "enemy should spawn successfully").toBe(true);
  expect(spawnResult.enemyId, "spawned enemy should have an ID").toBeTruthy();

  // Poll until the enemy appears in getUnits
  const unitBefore = await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const api = window.__GAME_TEST__!;
          const units = api.getUnits();
          const unit = units.find((u) => u.id === id);
          if (!unit) return null;
          return {
            id: unit.id,
            health: unit.health,
            col: unit.col,
            row: unit.row,
            state: unit.state,
            active: unit.active,
            team: unit.team,
          };
        }, spawnResult.enemyId!),
      { timeout: 5_000, message: "the spawned enemy should appear in getUnits" },
    )
    .not.toBeNull();

  // Verify the enemy is alive and occupies a cell
  expect(unitBefore!.health).toBeGreaterThan(0);
  expect(unitBefore!.active).toBe(true);

  // Check the grid cell shows as occupied
  const cellOccupied = await page.evaluate(
    (cell) => window.__GAME_TEST__!.getGrid().cells[cell.row][cell.col].occupied,
    freeCell,
  );
  expect(cellOccupied).toBe(true);

  // Count living enemies before damage
  const livingBefore = await page.evaluate(() => {
    return window.__GAME_TEST__!.getUnits().filter(
      (u) => u.health > 0 && u.active && u.state !== "dead",
    ).length;
  });

  // Apply lethal damage (enough to kill a Goblin with 50 HP)
  const damaged = await page.evaluate(
    ({ unitId, damage }) => window.__GAME_TEST__!.damageUnit(unitId, damage),
    { unitId: spawnResult.enemyId!, damage: 999 },
  );
  expect(damaged, "damageUnit should return true").toBe(true);

  // Poll until the enemy is dead and the cell is free
  await expect
    .poll(
      () =>
        page.evaluate(({ unitId, cell }) => {
          const api = window.__GAME_TEST__!;
          const units = api.getUnits();
          const unit = units.find((u) => u.id === unitId);
          const gridCell = api.getGrid().cells[cell.row][cell.col];
          return {
            unitIsDead: !unit || unit.state === "dead" || !unit.active || unit.health <= 0,
            cellIsFree: !gridCell.occupied,
          };
        }, { unitId: spawnResult.enemyId!, cell: freeCell }),
      {
        timeout: 15_000,
        message: "the dead enemy should release its occupied grid cell",
      },
    )
    .toEqual({
      unitIsDead: true,
      cellIsFree: true,
    });

  // Verify living count decreased
  const livingAfter = await page.evaluate(() => {
    return window.__GAME_TEST__!.getUnits().filter(
      (u) => u.health > 0 && u.active && u.state !== "dead",
    ).length;
  });
  expect(livingAfter).toBe(livingBefore - 1);

  // Verify no internal errors
  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__!.getState().errors), {
      message: "the game should report no errors",
    })
    .toEqual([]);
});
