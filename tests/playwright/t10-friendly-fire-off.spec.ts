import { expect, test } from "@playwright/test";

type Cell = { col: number; row: number; type: string; occupied: boolean };
type UnitTeam = "player" | "enemy";
type UnitState = {
  id: string;
  col: number;
  row: number;
  team: UnitTeam;
  health?: number;
  range?: number;
};

interface T10GameTestApi {
  isReady(): boolean;
  getGrid(): { cells: Cell[][] };
  getState(): { units: UnitState[]; errors: string[] };
  spawnUnit(params: {
    id: string;
    col: number;
    row: number;
    type: string;
    team: UnitTeam;
  }): UnitState;
  advanceTurns(turns: number): void;
}

test("units do not damage their own team when friendly fire is off", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__?.isReady() ?? false), {
      timeout: 15_000,
      message: "the game should become ready",
    })
    .toBe(true);

  const supportsCombatSetup = await page.evaluate(() => {
    const api = window.__GAME_TEST__ as unknown as Partial<T10GameTestApi>;
    return ["spawnUnit", "advanceTurns"].every(
      (method) => typeof api[method as keyof T10GameTestApi] === "function",
    );
  });
  expect(supportsCombatSetup, "GameTestApi must expose the T10 combat methods").toBe(true);

  const setup = await page.evaluate(() => {
    const api = window.__GAME_TEST__ as unknown as T10GameTestApi;
    const freeCells = api
      .getGrid()
      .cells.flat()
      .filter((cell) => cell.type !== "blocked" && !cell.occupied);
    const distance = (a: Cell, b: Cell) => Math.hypot(a.col - b.col, a.row - b.row);
    const attackerCell = freeCells.find(
      (candidate) =>
        freeCells.filter((cell) => cell !== candidate && distance(candidate, cell) <= 1.5).length >=
        2,
    );
    if (!attackerCell) throw new Error("the grid needs three adjacent free cells");

    const [allyCell, enemyCell] = freeCells
      .filter((cell) => cell !== attackerCell && distance(attackerCell, cell) <= 1.5)
      .slice(0, 2);

    const attacker = api.spawnUnit({
      id: "t10-player-attacker",
      col: attackerCell.col,
      row: attackerCell.row,
      type: "tower",
      team: "player",
    });
    const ally = api.spawnUnit({
      id: "t10-player-ally",
      col: allyCell.col,
      row: allyCell.row,
      type: "tower",
      team: "player",
    });

    const units = api.getState().units;
    const attackerState = units.find((unit) => unit.id === attacker.id);
    const allyState = units.find((unit) => unit.id === ally.id);
    if (!attackerState || !allyState) {
      throw new Error("the allied T10 units were not exposed by the API");
    }

    return {
      attackerId: attacker.id,
      attackerHealth: attackerState.health,
      attackerRange: attackerState.range ?? 0,
      allyId: ally.id,
      allyHealth: allyState.health,
      allyDistance: distance(attackerCell, allyCell),
      enemyCell: { col: enemyCell.col, row: enemyCell.row },
      enemyDistance: distance(attackerCell, enemyCell),
    };
  });

  expect(setup.attackerHealth).toBeGreaterThan(0);
  expect(setup.allyHealth).toBeGreaterThan(0);
  expect(setup.allyDistance).toBeLessThanOrEqual(setup.attackerRange);

  const alliedHealthAfterCombat = await page.evaluate(({ attackerId, allyId }) => {
    const api = window.__GAME_TEST__ as unknown as T10GameTestApi;
    api.advanceTurns(20);
    const units = api.getState().units;
    return {
      attacker: units.find((unit) => unit.id === attackerId)?.health,
      ally: units.find((unit) => unit.id === allyId)?.health,
    };
  }, setup);

  expect(alliedHealthAfterCombat.attacker).toBe(setup.attackerHealth);
  expect(alliedHealthAfterCombat.ally).toBe(setup.allyHealth);

  const enemy = await page.evaluate(({ enemyCell }) => {
    const api = window.__GAME_TEST__ as unknown as T10GameTestApi;
    const spawned = api.spawnUnit({
      id: "t10-enemy-control",
      col: enemyCell.col,
      row: enemyCell.row,
      type: "skeleton",
      team: "enemy",
    });
    const state = api.getState().units.find((unit) => unit.id === spawned.id);
    if (!state) throw new Error("the enemy control unit was not exposed by the API");
    return { id: spawned.id, health: state.health };
  }, setup);

  expect(setup.enemyDistance).toBeLessThanOrEqual(setup.attackerRange);
  expect(enemy.health).toBeGreaterThan(0);

  await expect
    .poll(
      () =>
        page.evaluate((enemyId) => {
          const api = window.__GAME_TEST__ as unknown as T10GameTestApi;
          api.advanceTurns(1);
          return api.getState().units.find((unit) => unit.id === enemyId)?.health;
        }, enemy.id),
      { timeout: 10_000, message: "the enemy control unit should receive damage" },
    )
    .toBeLessThan(enemy.health!);

  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__!.getState().errors), {
      message: "the game should report no errors",
    })
    .toEqual([]);
});
