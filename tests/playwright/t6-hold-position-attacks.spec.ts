import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const DEFENDER_ID = "holding-defender";
const PATROL_ID = "moving-target";

test("hold-position ataca una patrulla en rango sin perseguirla", async ({ game }) => {
  const setup =
    await test.step("Dado una defensora fija y una patrulla que cruza su rango", async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("hold-fire-patrol", { friendlyFire: false });
      const defenderCell = game.point(scenario, "defender");
      const patrolStart = game.point(scenario, "patrolStart");
      const patrolEnd = game.point(scenario, "patrolEnd");
      const defender = await game.spawnUnit({
        scenarioId: scenario.id,
        id: DEFENDER_ID,
        archetype: "test-ranged-unit",
        team: "player",
        cell: defenderCell,
        stats: { damage: 10, rangeCells: 2, fireCooldownFrames: 1 },
      });
      await game.spawnUnit({
        scenarioId: scenario.id,
        id: PATROL_ID,
        archetype: "goblin",
        team: "enemy",
        cell: patrolStart,
        stats: { hp: 100 },
      });
      return { scenario, defender, patrolStart, patrolEnd };
    });

  const hold = await test.step("Cuando ambas unidades reciben sus órdenes", async () => {
    const defenderOrder = await game.issueOrder(DEFENDER_ID, { type: "hold-position" });
    await game.issueOrder(PATROL_ID, {
      type: "patrol",
      endpoints: [setup.patrolStart, setup.patrolEnd],
    });
    return defenderOrder;
  });

  await test.step("Entonces adquiere y daña al objetivo solamente al entrar en rango", async () => {
    const acquired = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "event", eventType: "target.acquired", unitId: DEFENDER_ID },
    });
    expect(acquired.matchedEvent).toMatchObject({
      unitId: DEFENDER_ID,
      targetId: PATROL_ID,
    });

    const damaged = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence: acquired.matchedEvent.sequence,
      condition: { type: "event", eventType: "damage.applied", targetId: PATROL_ID },
    });
    expect(damaged.matchedEvent).toMatchObject({ sourceId: DEFENDER_ID, targetId: PATROL_ID });
    expect(getUnit(damaged.snapshot, PATROL_ID).hp).toBeLessThan(100);
  });

  await test.step("Y no abandona hold-position cuando la patrulla sale de rango", async () => {
    const lost = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "event", eventType: "target.lost", unitId: DEFENDER_ID },
    });
    expect(lost.matchedEvent.targetId).toBe(PATROL_ID);
    expect(getUnit(lost.snapshot, DEFENDER_ID)).toMatchObject({
      cell: setup.defender.cell,
      world: setup.defender.world,
      movement: { mode: "holding" },
      combat: { targetId: null },
      order: { id: hold.id, status: "running" },
    });
  });
});
