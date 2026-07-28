import { expect, test } from "./support/GameTestFixture";
import { eventsOfType, getUnit } from "./support/GameTestDriver";

const ATTACKER_ID = "range-archer";
const TARGET_ID = "approaching-target";

test("una arquera en hold ataca solo cuando un objetivo entra a su rango", async ({ game }) => {
  const setup = await test.step("Dada una arquera fija y un objetivo fuera de rango", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("hold-fire-enters-range");
    const attackerCell = game.point(scenario, "attacker");
    const targetStart = game.point(scenario, "targetStart");
    const targetOutOfRange = game.point(scenario, "targetOutOfRange");
    const targetInRange = game.point(scenario, "targetInRange");

    await game.spawnUnit({
      scenarioId: scenario.id,
      id: ATTACKER_ID,
      archetype: "archer",
      team: "player",
      cell: attackerCell,
      stats: { damage: 20, rangeCells: 3, fireCooldownFrames: 90 },
    });
    await game.spawnUnit({
      scenarioId: scenario.id,
      id: TARGET_ID,
      archetype: "goblin",
      team: "enemy",
      cell: targetStart,
      stats: { hp: 100, movementFramesPerCell: 60 },
    });
    const hold = await game.issueOrder(ATTACKER_ID, { type: "hold-position" });
    await game.issueOrder(TARGET_ID, { type: "move", destination: targetInRange });
    return { scenario, attackerCell, targetOutOfRange, targetInRange, hold };
  });

  let afterSequence = 0;

  await test.step("Cuando el objetivo alcanza una celda que sigue fuera de rango", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "unit-entered-cell", unitId: TARGET_ID, cell: setup.targetOutOfRange },
    });
    afterSequence = result.matchedEvent.sequence;
    expect(getUnit(result.snapshot, ATTACKER_ID)).toMatchObject({
      cell: setup.attackerCell,
      hp: 80,
      movement: { mode: "holding" },
      order: { id: setup.hold.id, status: "running" },
    });
    expect(eventsOfType(result.snapshot, "target.acquired").filter((event) => event.unitId === ATTACKER_ID)).toEqual([]);
    expect(eventsOfType(result.snapshot, "damage.applied").filter((event) => event.sourceId === ATTACKER_ID)).toEqual([]);
  });

  await test.step("Entonces adquiere y daña al objetivo al entrar exactamente en rango", async () => {
    const acquired = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "target.acquired", unitId: ATTACKER_ID, targetId: TARGET_ID },
    });
    afterSequence = acquired.matchedEvent.sequence;
    expect(getUnit(acquired.snapshot, TARGET_ID)).toMatchObject({ cell: setup.targetInRange });
    expect(getUnit(acquired.snapshot, ATTACKER_ID)).toMatchObject({ cell: setup.attackerCell });

    const damaged = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "damage.applied", sourceId: ATTACKER_ID, targetId: TARGET_ID },
    });
    expect(damaged.matchedEvent).toMatchObject({ amount: 20, hpBefore: 100, hpAfter: 80 });
    expect(getUnit(damaged.snapshot, ATTACKER_ID)).toMatchObject({
      cell: setup.attackerCell,
      movement: { mode: "holding" },
    });
    expect(damaged.snapshot.errors).toEqual([]);
  });
});
