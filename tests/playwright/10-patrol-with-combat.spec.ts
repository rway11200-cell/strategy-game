import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const PATROL_ID = "patrolling-warrior";
const TARGET_ID = "patrol-target";

test("una patrulla ataca a un enemigo en su camino sin interrumpir su ronda", async ({
  game,
}) => {
  const setup = await test.step(
    "Dado un guerrero que patrulla de (2,2) a (6,2) y un blanco en (4,3)",
    async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("warrior-patrol-square");
      const patrolStart = game.point(scenario, "patrolStart");
      const patrolEnd = game.point(scenario, "patrolEnd");
      const targetCell = game.point(scenario, "target");

      const warrior = await game.spawnUnit({
        scenarioId: scenario.id,
        id: PATROL_ID,
        archetype: "warrior",
        team: "player",
        cell: patrolStart,
        stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 60 },
      });
      const target = await game.spawnUnit({
        scenarioId: scenario.id,
        id: TARGET_ID,
        archetype: "warrior",
        team: "enemy",
        cell: targetCell,
        stats: { hp: 200 },
      });

      expect(warrior).toMatchObject({ id: PATROL_ID, cell: patrolStart, active: true });
      expect(target).toMatchObject({ id: TARGET_ID, cell: targetCell, active: true });
      return { scenario, patrolStart, patrolEnd, targetCell };
    },
  );

  const patrolOrder = await test.step("Cuando recibe orden de patrullar entre los dos puntos", async () => {
    const order = await game.issueOrder(PATROL_ID, {
      type: "patrol",
      endpoints: [setup.patrolStart, setup.patrolEnd],
    });
    expect(order).toMatchObject({
      unitId: PATROL_ID,
      type: "patrol",
      status: "running",
      endpoints: [setup.patrolStart, setup.patrolEnd],
    });
    return order;
  });

  let afterSequence = 0;

  await test.step("Entonces persigue al blanco visible hasta el borde de su rango", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: {
        type: "unit-entered-cell",
        unitId: PATROL_ID,
        cell: { col: 3, row: 3 },
      },
    });
    afterSequence = result.matchedEvent.sequence;
    expect(getUnit(result.snapshot, PATROL_ID)).toMatchObject({
      cell: { col: 3, row: 3 },
      activity: "attacking",
      movement: { mode: "patrolling", targetCell: null, stepProgress: 0 },
      order: { id: patrolOrder.id, status: "running" },
    });
    expect(result.snapshot.errors).toEqual([]);
  });

  await test.step("Y persigue al blanco, se detiene y le inflige daño sin cancelar la patrulla", async () => {
    const damaged = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "damage.applied", sourceId: PATROL_ID },
      maxFrames: 200,
    });
    expect(damaged.matchedEvent).toMatchObject({
      sourceId: PATROL_ID,
      targetId: TARGET_ID,
    });
    expect(getUnit(damaged.snapshot, PATROL_ID)).toMatchObject({
      activity: "attacking",
      movement: { targetCell: null, stepProgress: 0 },
      order: { id: patrolOrder.id, status: "running" },
    });
    expect(getUnit(damaged.snapshot, TARGET_ID).hp).toBe(200 - 10);
    expect(damaged.snapshot.errors).toEqual([]);
  });

  await test.step("Y el escenario se limpia sin residuos", async () => {
    const cleanup = await game.cleanup(setup.scenario.id);
    expect(cleanup).toMatchObject({
      remainingTestUnitIds: [],
      leakedOccupations: [],
      pendingOrderIds: [],
      pendingProjectileIds: [],
    });
  });
});
