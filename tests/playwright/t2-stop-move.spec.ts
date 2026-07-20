import { expect, test } from "@playwright/test";

type Cell = { col: number; row: number; type: string; occupied: boolean };
type Position = { col: number; row: number };
type UnitState = Position & { id: string };

interface T2GameTestApi {
  isReady(): boolean;
  getGrid(): { cells: Cell[][] };
  getState(): { units: UnitState[]; errors: string[] };
  spawnUnit(params: {
    id: string;
    col: number;
    row: number;
    type: string;
    team: string;
  }): UnitState;
  moveTo(unitId: string, col: number, row: number): void;
  stop(unitId: string): void;
}

test("stop prevents a moving unit from reaching its destination", async ({ page }) => {
  await page.goto("http://localhost:5173");

  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__?.isReady() ?? false), {
      timeout: 15_000,
      message: "the game should become ready",
    })
    .toBe(true);

  const supportsMovementCommands = await page.evaluate(() => {
    const api = window.__GAME_TEST__ as unknown as Partial<T2GameTestApi>;
    return ["spawnUnit", "moveTo", "stop"].every(
      (method) => typeof api[method as keyof T2GameTestApi] === "function",
    );
  });
  expect(supportsMovementCommands, "GameTestApi must expose the T2 movement methods").toBe(true);

  const setup = await page.evaluate(() => {
    const api = window.__GAME_TEST__ as unknown as T2GameTestApi;
    const freeCells = api
      .getGrid()
      .cells.flat()
      .filter((cell) => cell.type !== "blocked" && !cell.occupied);
    const freeByKey = new Map(freeCells.map((cell) => [`${cell.col},${cell.row}`, cell]));
    const directions = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];

    let route: { origin: Cell; destination: Cell } | undefined;
    for (const origin of freeCells) {
      const queue = [{ cell: origin, distance: 0 }];
      const visited = new Set([`${origin.col},${origin.row}`]);
      let farthest = queue[0];

      for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        if (current.distance > farthest.distance) farthest = current;

        for (const [deltaCol, deltaRow] of directions) {
          const key = `${current.cell.col + deltaCol},${current.cell.row + deltaRow}`;
          const neighbour = freeByKey.get(key);
          if (!neighbour || visited.has(key)) continue;
          visited.add(key);
          queue.push({ cell: neighbour, distance: current.distance + 1 });
        }
      }

      if (farthest.distance >= 6) {
        route = { origin, destination: farthest.cell };
        break;
      }
    }

    if (!route) throw new Error("the grid needs two connected cells at least six steps apart");

    const spawned = api.spawnUnit({
      id: "t2-stoppable-unit",
      col: route.origin.col,
      row: route.origin.row,
      type: "goblin",
      team: "player",
    });
    const unitId = spawned.id;
    api.moveTo(unitId, route.destination.col, route.destination.row);

    return {
      unitId,
      origin: { col: route.origin.col, row: route.origin.row },
      destination: { col: route.destination.col, row: route.destination.row },
    };
  });

  await expect
    .poll(
      () =>
        page.evaluate(({ unitId, origin, destination }) => {
          const api = window.__GAME_TEST__ as unknown as T2GameTestApi;
          const unit = api.getState().units.find((candidate) => candidate.id === unitId);
          if (!unit) return { moved: false, arrived: false };
          return {
            moved: unit.col !== origin.col || unit.row !== origin.row,
            arrived: unit.col === destination.col && unit.row === destination.row,
          };
        }, setup),
      {
        timeout: 10_000,
        intervals: [50, 100, 200],
        message: "the unit should advance part of the route without reaching the destination",
      },
    )
    .toEqual({ moved: true, arrived: false });

  const stoppedAt = await page.evaluate((unitId) => {
    const api = window.__GAME_TEST__ as unknown as T2GameTestApi;
    api.stop(unitId);
    const unit = api.getState().units.find((candidate) => candidate.id === unitId);
    if (!unit) throw new Error("the stopped unit was not exposed by the API");
    return { col: unit.col, row: unit.row };
  }, setup.unitId);

  expect(stoppedAt).not.toEqual(setup.destination);
  await page.waitForTimeout(750);

  await expect
    .poll(
      () =>
        page.evaluate((unitId) => {
          const api = window.__GAME_TEST__ as unknown as T2GameTestApi;
          const unit = api.getState().units.find((candidate) => candidate.id === unitId);
          return unit ? { col: unit.col, row: unit.row } : null;
        }, setup.unitId),
      { timeout: 2_000, message: "the unit should remain stopped" },
    )
    .toEqual(stoppedAt);

  expect(stoppedAt).not.toEqual(setup.destination);
  expect(await page.evaluate(() => window.__GAME_TEST__!.getState().errors)).toEqual([]);
});
