import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const ATTACKER_ID = "direct-attacker";
const TARGET_ID = "direct-target";

test("una orden de ataque directo persigue y daña al objetivo indicado", async ({ game }) => {
  const setup = await test.step("Dado un atacante y un objetivo fuera de alcance", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("warrior-auto-move");
    const attackerStart = game.point(scenario, "attackerStart");
    const targetCell = game.point(scenario, "defender");

    await game.spawnUnit({
      scenarioId: scenario.id,
      id: ATTACKER_ID,
      archetype: "warrior",
      team: "player",
      cell: attackerStart,
      stats: { hp: 200, damage: 20, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 60 },
    });
    await game.spawnUnit({
      scenarioId: scenario.id,
      id: TARGET_ID,
      archetype: "warrior",
      team: "enemy",
      cell: targetCell,
      stats: { hp: 100 },
    });
    return { scenario, targetCell };
  });

  const order = await test.step("Cuando recibe una orden de ataque al objetivo", async () => {
    const order = await game.issueOrder(ATTACKER_ID, { type: "attack", targetId: TARGET_ID });
    expect(order).toMatchObject({ unitId: ATTACKER_ID, type: "attack", status: "running", targetId: TARGET_ID });
    return order;
  });

  let afterSequence = 0;

  await test.step("Entonces lo persigue hasta el borde de alcance", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "unit-entered-cell", unitId: ATTACKER_ID, cell: { col: 1, row: 0 } },
    });
    afterSequence = result.matchedEvent.sequence;
    expect(getUnit(result.snapshot, ATTACKER_ID)).toMatchObject({ activity: "pursuing", order: { id: order.id, status: "running" } });
  });

  await test.step("Y se detiene para dañar exactamente al objetivo ordenado", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "damage.applied", sourceId: ATTACKER_ID, targetId: TARGET_ID },
    });
    expect(result.matchedEvent).toMatchObject({ amount: 20, hpBefore: 100, hpAfter: 80 });
    expect(getUnit(result.snapshot, ATTACKER_ID)).toMatchObject({
      activity: "attacking",
      movement: { targetCell: null, stepProgress: 0 },
      order: { id: order.id, status: "running", targetId: TARGET_ID },
    });
    expect(getUnit(result.snapshot, TARGET_ID)).toMatchObject({ cell: setup.targetCell, hp: 80 });
    expect(result.snapshot.errors).toEqual([]);
  });
});
