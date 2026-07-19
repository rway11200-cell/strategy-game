import { expect, test } from "@playwright/test";

type Cell = { col: number; row: number; type: string; occupied: boolean };
type SpawnedUnit = { id: string; towerId?: string };
type UnitState = {
  id: string;
  col: number;
  row: number;
  health?: number;
  range?: number;
};

interface T4GameTestApi {
  isReady(): boolean;
  getGrid(): { cells: Cell[][] };
  getState(): { errors: string[] };
  getTowers(): UnitState[];
  getEnemies(): UnitState[];
  spawnUnit(params: {
    id: string;
    col: number;
    row: number;
    type: string;
    team: string;
  }): SpawnedUnit;
  moveUnit(unitId: string, col: number, row: number): void;
  setHoldPosition(unitId: string, hold: boolean): void;
  advanceTurns(turns: number): void;
}

test("unit in hold position does not move when an enemy passes nearby", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__?.isReady() ?? false), {
      timeout: 15_000,
      message: "the game should become ready",
    })
    .toBe(true);

  const supportsUnitCommands = await page.evaluate(() => {
    const api = window.__GAME_TEST__ as unknown as Partial<T4GameTestApi>;
    return ["spawnUnit", "moveUnit", "setHoldPosition", "advanceTurns"].every(
      (method) => typeof api[method as keyof T4GameTestApi] === "function",
    );
  });
  expect(supportsUnitCommands, "GameTestApi must expose the T4 unit command methods").toBe(true);

  const setup = await page.evaluate(() => {
    const api = window.__GAME_TEST__ as unknown as T4GameTestApi;
    const freeCells = api
      .getGrid()
      .cells.flat()
      .filter((cell) => cell.type !== "blocked" && !cell.occupied);
    const distance = (a: Cell, b: Cell) => Math.hypot(a.col - b.col, a.row - b.row);

    const allyCell = freeCells.find((candidate) => {
      const adjacent = freeCells.filter(
        (cell) => cell !== candidate && distance(candidate, cell) <= 1.5,
      );
      const enemyStart = freeCells.find((cell) => distance(candidate, cell) >= 3);
      return adjacent.length >= 2 && enemyStart !== undefined;
    });
    if (!allyCell) throw new Error("the grid needs a free cell with two free neighbours");

    const adjacentCells = freeCells
      .filter((cell) => cell !== allyCell && distance(allyCell, cell) <= 1.5)
      .slice(0, 2);
    const enemyStart = freeCells.find((cell) => distance(allyCell, cell) >= 3);
    if (!enemyStart) throw new Error("the grid needs a free enemy starting cell");

    const ally = api.spawnUnit({
      id: "t4-ally",
      col: allyCell.col,
      row: allyCell.row,
      type: "tower",
      team: "player",
    });
    const enemy = api.spawnUnit({
      id: "t4-enemy",
      col: enemyStart.col,
      row: enemyStart.row,
      type: "skeleton",
      team: "enemy",
    });
    const allyId = ally.towerId ?? ally.id;
    api.setHoldPosition(allyId, true);

    const allyState = api.getTowers().find((unit) => unit.id === allyId);
    const enemyState = api.getEnemies().find((unit) => unit.id === enemy.id);
    if (!allyState || !enemyState) throw new Error("spawned T4 units were not exposed by the API");

    return {
      allyId,
      allyCell: { col: allyState.col, row: allyState.row },
      allyRange: allyState.range ?? 0,
      enemyId: enemy.id,
      enemyHealth: enemyState.health,
      adjacentCells: adjacentCells.map(({ col, row }) => ({ col, row })),
    };
  });

  expect(setup.allyRange).toBeGreaterThanOrEqual(1);
  expect(setup.enemyHealth).toBeGreaterThan(0);

  for (const destination of setup.adjacentCells) {
    await page.evaluate(
      ({ enemyId, cell }) => {
        const api = window.__GAME_TEST__ as unknown as T4GameTestApi;
        api.moveUnit(enemyId, cell.col, cell.row);
      },
      { enemyId: setup.enemyId, cell: destination },
    );

    await expect
      .poll(
        () =>
          page.evaluate((enemyId) => {
            const api = window.__GAME_TEST__ as unknown as T4GameTestApi;
            api.advanceTurns(1);
            const enemy = api.getEnemies().find((unit) => unit.id === enemyId);
            return enemy ? { col: enemy.col, row: enemy.row } : null;
          }, setup.enemyId),
        { timeout: 10_000, message: "the enemy should move through an adjacent cell" },
      )
      .toEqual(destination);

    await expect
      .poll(
        () =>
          page.evaluate((allyId) => {
            const api = window.__GAME_TEST__ as unknown as T4GameTestApi;
            const ally = api.getTowers().find((unit) => unit.id === allyId);
            return ally ? { col: ally.col, row: ally.row } : null;
          }, setup.allyId),
        { timeout: 2_000, message: "the allied unit should remain in hold position" },
      )
      .toEqual(setup.allyCell);
  }

  await expect
    .poll(
      () =>
        page.evaluate((enemyId) => {
          const api = window.__GAME_TEST__ as unknown as T4GameTestApi;
          api.advanceTurns(1);
          return api.getEnemies().find((unit) => unit.id === enemyId)?.health;
        }, setup.enemyId),
      { timeout: 10_000, message: "the in-range enemy should receive damage" },
    )
    .toBeLessThan(setup.enemyHealth!);

  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__!.getState().errors), {
      message: "the game should report no errors",
    })
    .toEqual([]);
});
