import { expect, test } from "@playwright/test";

type Team = "player" | "enemy";
type Cell = { col: number; row: number; type: string; occupied: boolean };
type CombatUnitState = {
  id: string;
  col: number;
  row: number;
  team: Team;
  health: number;
  state?: string;
  active?: boolean;
};
type CombatUnitConfig = {
  id: string;
  team: Team;
  health: number;
  attack: number;
  defense: number;
};

interface CombatGameTestApi {
  isReady(): boolean;
  getGrid(): { cells: Cell[][] };
  getState(): { units: CombatUnitState[]; errors: string[] };
  spawnUnit(params: CombatUnitConfig & { col: number; row: number; type: string }): CombatUnitState;
  resolveCombatTick(attacks: { attackerId: string; targetId: string }[]): void;
}

const unitConfigs: CombatUnitConfig[] = [
  { id: "team-a-1", team: "player", health: 30, attack: 40, defense: 5 },
  { id: "team-a-2", team: "player", health: 100, attack: 30, defense: 10 },
  { id: "team-a-3", team: "player", health: 100, attack: 20, defense: 0 },
  { id: "team-b-1", team: "enemy", health: 30, attack: 50, defense: 5 },
  { id: "team-b-2", team: "enemy", health: 100, attack: 25, defense: 10 },
  { id: "team-b-3", team: "enemy", health: 100, attack: 10, defense: 5 },
];

test("three units per team resolve one combat tick simultaneously", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__?.isReady() ?? false), {
      timeout: 15_000,
      message: "the game should become ready",
    })
    .toBe(true);

  const supportsSimultaneousCombat = await page.evaluate(() => {
    const api = window.__GAME_TEST__ as unknown as Partial<CombatGameTestApi>;
    return ["spawnUnit", "resolveCombatTick"].every(
      (method) => typeof api[method as keyof CombatGameTestApi] === "function",
    );
  });
  expect(
    supportsSimultaneousCombat,
    "GameTestApi must expose simultaneous combat setup and resolution",
  ).toBe(true);

  const result = await page.evaluate((configs) => {
    const api = window.__GAME_TEST__ as unknown as CombatGameTestApi;
    const cells = api
      .getGrid()
      .cells.flat()
      .filter((cell) => cell.type !== "blocked" && !cell.occupied)
      .slice(0, configs.length);
    if (cells.length < configs.length) throw new Error("the grid needs six distinct free cells");

    const spawned = configs.map((config, index) =>
      api.spawnUnit({
        ...config,
        col: cells[index].col,
        row: cells[index].row,
        type: config.team === "player" ? "tower" : "skeleton",
      }),
    );
    const byConfiguredId = new Map(configs.map((config, index) => [config.id, spawned[index].id]));
    const attacks = [
      ["team-a-1", "team-b-1"],
      ["team-a-2", "team-b-2"],
      ["team-a-3", "team-b-3"],
      ["team-b-1", "team-a-1"],
      ["team-b-2", "team-a-2"],
      ["team-b-3", "team-a-3"],
    ].map(([attacker, target]) => ({
      attackerId: byConfiguredId.get(attacker)!,
      targetId: byConfiguredId.get(target)!,
    }));

    const before = api
      .getState()
      .units.filter((unit) => spawned.some((combatant) => combatant.id === unit.id));
    api.resolveCombatTick(attacks);
    const state = api.getState();

    return {
      ids: Object.fromEntries(byConfiguredId),
      positions: spawned.map(({ col, row }) => `${col},${row}`),
      before,
      after: state.units.filter((unit) => spawned.some((combatant) => combatant.id === unit.id)),
      errors: state.errors,
    };
  }, unitConfigs);

  expect(new Set(result.positions).size).toBe(6);
  expect(result.before).toHaveLength(6);
  expect(result.before.filter((unit) => unit.team === "player")).toHaveLength(3);
  expect(result.before.filter((unit) => unit.team === "enemy")).toHaveLength(3);

  const afterById = new Map(result.after.map((unit) => [unit.id, unit]));
  const isDead = (configuredId: string) => {
    const unit = afterById.get(result.ids[configuredId]);
    return !unit || unit.health <= 0 || unit.state === "dead" || unit.active === false;
  };
  const healthOf = (configuredId: string) => afterById.get(result.ids[configuredId])?.health;

  expect(isDead("team-a-1")).toBe(true);
  expect(isDead("team-b-1")).toBe(true);
  expect(healthOf("team-a-2")).toBe(85);
  expect(healthOf("team-b-2")).toBe(80);
  expect(healthOf("team-a-3")).toBe(90);
  expect(healthOf("team-b-3")).toBe(85);
  expect(result.errors).toEqual([]);
});
