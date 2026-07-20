# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: t4-hold-position-no-move.spec.ts >> unit in hold position does not move when an enemy passes nearby
- Location: tests/playwright/t4-hold-position-no-move.spec.ts:31:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/
Call log:
  - navigating to "http://localhost:4173/", waiting until "load"

```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | type Cell = { col: number; row: number; type: string; occupied: boolean };
  4   | type SpawnedUnit = { id: string; towerId?: string };
  5   | type UnitState = {
  6   |   id: string;
  7   |   col: number;
  8   |   row: number;
  9   |   health?: number;
  10  |   range?: number;
  11  | };
  12  | 
  13  | interface T4GameTestApi {
  14  |   isReady(): boolean;
  15  |   getGrid(): { cells: Cell[][] };
  16  |   getState(): { errors: string[] };
  17  |   getTowers(): UnitState[];
  18  |   getEnemies(): UnitState[];
  19  |   spawnUnit(params: {
  20  |     id: string;
  21  |     col: number;
  22  |     row: number;
  23  |     type: string;
  24  |     team: string;
  25  |   }): SpawnedUnit;
  26  |   moveUnit(unitId: string, col: number, row: number): void;
  27  |   setHoldPosition(unitId: string, hold: boolean): void;
  28  |   advanceTurns(turns: number): void;
  29  | }
  30  | 
  31  | test("unit in hold position does not move when an enemy passes nearby", async ({ page }) => {
> 32  |   await page.goto("/");
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/
  33  | 
  34  |   await expect
  35  |     .poll(() => page.evaluate(() => window.__GAME_TEST__?.isReady() ?? false), {
  36  |       timeout: 15_000,
  37  |       message: "the game should become ready",
  38  |     })
  39  |     .toBe(true);
  40  | 
  41  |   const supportsUnitCommands = await page.evaluate(() => {
  42  |     const api = window.__GAME_TEST__ as unknown as Partial<T4GameTestApi>;
  43  |     return ["spawnUnit", "moveUnit", "setHoldPosition", "advanceTurns"].every(
  44  |       (method) => typeof api[method as keyof T4GameTestApi] === "function",
  45  |     );
  46  |   });
  47  |   expect(supportsUnitCommands, "GameTestApi must expose the T4 unit command methods").toBe(true);
  48  | 
  49  |   const setup = await page.evaluate(() => {
  50  |     const api = window.__GAME_TEST__ as unknown as T4GameTestApi;
  51  |     const freeCells = api
  52  |       .getGrid()
  53  |       .cells.flat()
  54  |       .filter((cell) => cell.type !== "blocked" && !cell.occupied);
  55  |     const distance = (a: Cell, b: Cell) => Math.hypot(a.col - b.col, a.row - b.row);
  56  | 
  57  |     const allyCell = freeCells.find((candidate) => {
  58  |       const adjacent = freeCells.filter(
  59  |         (cell) => cell !== candidate && distance(candidate, cell) <= 1.5,
  60  |       );
  61  |       const enemyStart = freeCells.find((cell) => distance(candidate, cell) >= 3);
  62  |       return adjacent.length >= 2 && enemyStart !== undefined;
  63  |     });
  64  |     if (!allyCell) throw new Error("the grid needs a free cell with two free neighbours");
  65  | 
  66  |     const adjacentCells = freeCells
  67  |       .filter((cell) => cell !== allyCell && distance(allyCell, cell) <= 1.5)
  68  |       .slice(0, 2);
  69  |     const enemyStart = freeCells.find((cell) => distance(allyCell, cell) >= 3);
  70  |     if (!enemyStart) throw new Error("the grid needs a free enemy starting cell");
  71  | 
  72  |     const ally = api.spawnUnit({
  73  |       id: "t4-ally",
  74  |       col: allyCell.col,
  75  |       row: allyCell.row,
  76  |       type: "tower",
  77  |       team: "player",
  78  |     });
  79  |     const enemy = api.spawnUnit({
  80  |       id: "t4-enemy",
  81  |       col: enemyStart.col,
  82  |       row: enemyStart.row,
  83  |       type: "skeleton",
  84  |       team: "enemy",
  85  |     });
  86  |     const allyId = ally.towerId ?? ally.id;
  87  |     api.setHoldPosition(allyId, true);
  88  | 
  89  |     const allyState = api.getTowers().find((unit) => unit.id === allyId);
  90  |     const enemyState = api.getEnemies().find((unit) => unit.id === enemy.id);
  91  |     if (!allyState || !enemyState) throw new Error("spawned T4 units were not exposed by the API");
  92  | 
  93  |     return {
  94  |       allyId,
  95  |       allyCell: { col: allyState.col, row: allyState.row },
  96  |       allyRange: allyState.range ?? 0,
  97  |       enemyId: enemy.id,
  98  |       enemyHealth: enemyState.health,
  99  |       adjacentCells: adjacentCells.map(({ col, row }) => ({ col, row })),
  100 |     };
  101 |   });
  102 | 
  103 |   expect(setup.allyRange).toBeGreaterThanOrEqual(1);
  104 |   expect(setup.enemyHealth).toBeGreaterThan(0);
  105 | 
  106 |   for (const destination of setup.adjacentCells) {
  107 |     await page.evaluate(
  108 |       ({ enemyId, cell }) => {
  109 |         const api = window.__GAME_TEST__ as unknown as T4GameTestApi;
  110 |         api.moveUnit(enemyId, cell.col, cell.row);
  111 |       },
  112 |       { enemyId: setup.enemyId, cell: destination },
  113 |     );
  114 | 
  115 |     await expect
  116 |       .poll(
  117 |         () =>
  118 |           page.evaluate((enemyId) => {
  119 |             const api = window.__GAME_TEST__ as unknown as T4GameTestApi;
  120 |             api.advanceTurns(1);
  121 |             const enemy = api.getEnemies().find((unit) => unit.id === enemyId);
  122 |             return enemy ? { col: enemy.col, row: enemy.row } : null;
  123 |           }, setup.enemyId),
  124 |         { timeout: 10_000, message: "the enemy should move through an adjacent cell" },
  125 |       )
  126 |       .toEqual(destination);
  127 | 
  128 |     await expect
  129 |       .poll(
  130 |         () =>
  131 |           page.evaluate((allyId) => {
  132 |             const api = window.__GAME_TEST__ as unknown as T4GameTestApi;
```