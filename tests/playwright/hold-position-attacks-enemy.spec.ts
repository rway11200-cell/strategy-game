import { expect, test, type Page } from "@playwright/test";

async function waitForGameReady(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__GAME_TEST__?.isReady === "function" && window.__GAME_TEST__.isReady(),
    undefined,
    { timeout },
  );
}

test("blue unit attacks an in-range red unit while holding position", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await waitForGameReady(page);

  const grid = await page.evaluate(() => window.__GAME_TEST__!.getGrid());
  const blueCell = grid.cells.flat().find((cell) => {
    const redCell = grid.cells[cell.row]?.[cell.col + 1];
    return (
      cell.type !== "blocked" &&
      !cell.occupied &&
      redCell?.type !== "blocked" &&
      redCell?.occupied === false
    );
  });

  expect(blueCell, "the grid needs two adjacent free cells").toBeDefined();
  const redCell = { col: blueCell!.col + 1, row: blueCell!.row };
  const redWorldPosition = {
    x: (redCell.col + 0.5) * grid.tileSize,
    y: (redCell.row + 0.5) * grid.tileSize,
  };

  const setup = await page.evaluate(
    ({ blue, red }) => {
      const api = window.__GAME_TEST__!;
      return {
        bluePlaced: api.placeTower(blue.col, blue.row),
        redSpawned: api.spawnEnemy(red.col, red.row, "basic"),
      };
    },
    { blue: blueCell!, red: redCell },
  );

  expect(setup.bluePlaced).toBe(true);
  expect(setup.redSpawned.success).toBe(true);

  const initial = await page.evaluate(
    ({ blue, red }) => {
      const api = window.__GAME_TEST__!;
      return {
        blue: api.getTowers().find((tower) => tower.col === blue.col && tower.row === blue.row),
        red: api.getEnemies().find((enemy) => enemy.worldX === red.x && enemy.worldY === red.y),
      };
    },
    { blue: blueCell!, red: redWorldPosition },
  );

  expect(initial.blue).toBeDefined();
  expect(initial.red).toBeDefined();
  expect(initial.red!.health).toBeGreaterThan(0);
  expect(
    Math.hypot(redCell.col - initial.blue!.col, redCell.row - initial.blue!.row),
  ).toBeLessThanOrEqual(initial.blue!.range);

  await expect
    .poll(
      () =>
        page.evaluate((position) => {
          const red = window
            .__GAME_TEST__!.getEnemies()
            .find((enemy) => enemy.worldX === position.x && enemy.worldY === position.y);
          return red?.health;
        }, redWorldPosition),
      { timeout: 10_000, message: "the red unit should receive damage" },
    )
    .toBeLessThan(initial.red!.health!);

  const finalBlue = await page.evaluate(
    ({ col, row }) =>
      window.__GAME_TEST__!.getTowers().find((tower) => tower.col === col && tower.row === row),
    blueCell!,
  );

  expect(finalBlue).toBeDefined();
  expect(finalBlue!.worldX).toBe(initial.blue!.worldX);
  expect(finalBlue!.worldY).toBe(initial.blue!.worldY);
});
