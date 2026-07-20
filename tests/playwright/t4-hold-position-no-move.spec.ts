import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const ALLY_ID = "holding-ally";
const ENEMY_ID = "passing-enemy";

test("hold-position mantiene una unidad inmóvil mientras un enemigo pasa cerca", async ({
  game,
}) => {
  const setup = await test.step("Dado una unidad aliada y un carril enemigo", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("hold-position-lane");
    const allyCell = game.point(scenario, "ally");
    const enemyStart = game.point(scenario, "enemyStart");
    const enemyEnd = game.point(scenario, "enemyEnd");
    const enemyPath = game.group(scenario, "enemyPath");

    const ally = await game.spawnUnit({
      scenarioId: scenario.id,
      id: ALLY_ID,
      archetype: "test-ranged-unit",
      team: "player",
      cell: allyCell,
    });
    await game.spawnUnit({
      scenarioId: scenario.id,
      id: ENEMY_ID,
      archetype: "goblin",
      team: "enemy",
      cell: enemyStart,
    });

    expect(ally).toMatchObject({ cell: allyCell, movement: { mode: "idle" } });
    return { scenario, ally, allyCell, enemyEnd, enemyPath };
  });

  const hold = await test.step("Cuando la aliada recibe hold-position", async () => {
    const order = await game.issueOrder(ALLY_ID, { type: "hold-position" });
    expect(order).toMatchObject({ type: "hold-position", status: "running" });
    await game.issueOrder(ENEMY_ID, { type: "move", destination: setup.enemyEnd });
    return order;
  });

  await test.step("Entonces no abandona su celda durante todo el recorrido enemigo", async () => {
    let afterSequence = 0;
    for (const enemyCell of setup.enemyPath) {
      const result = await game.advanceUntil({
        scenarioId: setup.scenario.id,
        afterSequence,
        condition: { type: "unit-entered-cell", unitId: ENEMY_ID, cell: enemyCell },
      });
      afterSequence = result.matchedEvent.sequence;
      expect(getUnit(result.snapshot, ALLY_ID)).toMatchObject({
        cell: setup.allyCell,
        world: setup.ally.world,
        occupiedCells: [setup.allyCell],
        movement: { mode: "holding", route: [], targetCell: null },
        order: { id: hold.id, status: "running" },
      });
    }

    const allyMoves = (await game.snapshot(setup.scenario.id)).events.filter(
      (event) => event.type === "unit.entered-cell" && event.unitId === ALLY_ID,
    );
    expect(allyMoves).toEqual([]);
  });
});
