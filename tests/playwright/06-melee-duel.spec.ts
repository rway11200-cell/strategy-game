import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const ATTACKER_ID = "blue-attacker";
const DEFENDER_ID = "blue-defender";

test("dos guerreros en celdas adyacentes intercambian daño hasta la muerte", async ({ game }) => {
  const setup = await test.step("Dado dos guerreros hostiles en (0,0) y (1,0)", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("warrior-duel");
    const attackerCell = game.point(scenario, "attacker");
    const defenderCell = game.point(scenario, "defender");

    const attacker = await game.spawnUnit({
      scenarioId: scenario.id,
      id: ATTACKER_ID,
      archetype: "warrior",
      team: "player",
      cell: attackerCell,
      stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30 },
    });
    const defender = await game.spawnUnit({
      scenarioId: scenario.id,
      id: DEFENDER_ID,
      archetype: "warrior",
      team: "enemy",
      cell: defenderCell,
      stats: { hp: 200, damage: 4, rangeCells: 1, fireCooldownFrames: 60 },
    });

    expect(attacker).toMatchObject({
      id: ATTACKER_ID,
      cell: attackerCell,
      occupiedCells: [attackerCell],
      combat: { damage: 10, rangeCells: 1 },
    });
    expect(defender).toMatchObject({
      id: DEFENDER_ID,
      cell: defenderCell,
      occupiedCells: [defenderCell],
      combat: { damage: 4, rangeCells: 1 },
    });
    return { scenario, attackerCell, defenderCell };
  });

  let afterSequence = 0;

  await test.step("Cuando ambos están en rango, intercambian daño melee", async () => {
    const firstHit = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "event", eventType: "damage.applied", sourceId: ATTACKER_ID },
      maxFrames: 200,
    });
    afterSequence = firstHit.matchedEvent.sequence;
    expect(firstHit.matchedEvent).toMatchObject({
      type: "damage.applied",
      sourceId: ATTACKER_ID,
      targetId: DEFENDER_ID,
    });
    expect(firstHit.snapshot.errors).toEqual([]);

    const counterHit = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "damage.applied", sourceId: DEFENDER_ID },
      maxFrames: 200,
    });
    afterSequence = counterHit.matchedEvent.sequence;
    expect(counterHit.matchedEvent).toMatchObject({
      type: "damage.applied",
      sourceId: DEFENDER_ID,
      targetId: ATTACKER_ID,
    });
    expect(counterHit.snapshot.errors).toEqual([]);
  });

  await test.step("Y ambos siguen vivos y en sus posiciones originales", async () => {
    const snapshot = await game.snapshot(setup.scenario.id);
    expect(getUnit(snapshot, ATTACKER_ID)).toMatchObject({
      lifecycle: "alive",
      cell: setup.attackerCell,
    });
    expect(getUnit(snapshot, DEFENDER_ID)).toMatchObject({
      lifecycle: "alive",
      cell: setup.defenderCell,
    });
    expect(snapshot.cells.filter((c) => c.occupied)).toHaveLength(2);
    expect(snapshot.errors).toEqual([]);
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
