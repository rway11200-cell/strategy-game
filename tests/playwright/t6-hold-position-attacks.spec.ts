import { expect, test } from "@playwright/test";

test("blue unit holds position and attacks a patrolling red unit", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__?.isReady() ?? false), {
      timeout: 15_000,
      message: "the game should become ready",
    })
    .toBe(true);

  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__!.getEnemies().length), {
      timeout: 15_000,
      message: "a red patrol unit should spawn",
    })
    .toBeGreaterThan(0);

  const setup = await page.evaluate(() => {
    const api = window.__GAME_TEST__!;
    const grid = api.getGrid();
    const red = api.getEnemies()[0];
    const redCell = {
      col: Math.floor(red.worldX / grid.tileSize),
      row: Math.floor(red.worldY / grid.tileSize),
    };
    const blueCell = grid.cells
      .flat()
      .filter((cell) => cell.type !== "blocked" && !cell.occupied)
      .sort(
        (a, b) =>
          Math.hypot(a.col - redCell.col, a.row - redCell.row) -
          Math.hypot(b.col - redCell.col, b.row - redCell.row),
      )
      .find((cell) => Math.hypot(cell.col - redCell.col, cell.row - redCell.row) <= 2);

    if (!blueCell || !api.placeTower(blueCell.col, blueCell.row)) return null;

    const blue = api
      .getTowers()
      .find((tower) => tower.col === blueCell.col && tower.row === blueCell.row);

    return blue
      ? {
          blueCell: { col: blueCell.col, row: blueCell.row },
          bluePosition: { x: blue.worldX, y: blue.worldY },
          redPosition: { x: red.worldX, y: red.worldY },
          redHealth: red.health,
        }
      : null;
  });

  expect(setup, "an in-range blue unit should be placed").not.toBeNull();
  expect(setup!.redHealth).toBeGreaterThan(0);

  await expect
    .poll(
      () =>
        page.evaluate(
          ({ x, y }) => {
            const red = window.__GAME_TEST__!.getEnemies()[0];
            return red ? Math.hypot(red.worldX - x, red.worldY - y) : 0;
          },
          setup!.redPosition,
        ),
      { timeout: 10_000, message: "the red unit should patrol along its route" },
    )
    .toBeGreaterThan(0);

  await expect
    .poll(
      () =>
        page.evaluate(
          (initialHealth) =>
            window
              .__GAME_TEST__!.getEnemies()
              .some((enemy) => enemy.health !== undefined && enemy.health < initialHealth),
          setup!.redHealth!,
        ),
      { timeout: 10_000, message: "the blue unit should damage a red patrol unit" },
    )
    .toBe(true);

  const finalBlue = await page.evaluate(
    ({ col, row }) =>
      window.__GAME_TEST__!.getTowers().find((tower) => tower.col === col && tower.row === row),
    setup!.blueCell,
  );

  expect(finalBlue).toBeDefined();
  expect({ x: finalBlue!.worldX, y: finalBlue!.worldY }).toEqual(setup!.bluePosition);
});
