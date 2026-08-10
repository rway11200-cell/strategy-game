import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const DEFENDER_ID = "holding-defender";
const ATTACKER_ID = "advancing-enemy";

test("un guerrero en hold-position repele a un agresor sin abandonar su celda", async ({
  game,
}) => {
  const setup = await test.step(
    "Dado un defensor firme en (3,0) y un agresor que avanza desde (0,0)",
    async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("warrior-hold-attack");
      const defenderCell = game.point(scenario, "defender");
      const attackerStart = game.point(scenario, "attackerStart");
      const attackerDest = game.point(scenario, "attackerDestination");

      const defender = await game.spawnUnit({
        scenarioId: scenario.id,
        id: DEFENDER_ID,
        archetype: "warrior",
        team: "player",
        cell: defenderCell,
        stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30 },
      });
      const attacker = await game.spawnUnit({
        scenarioId: scenario.id,
        id: ATTACKER_ID,
        archetype: "warrior",
        team: "enemy",
        cell: attackerStart,
        stats: { hp: 200, damage: 4, rangeCells: 1, fireCooldownFrames: 60, movementFramesPerCell: 60 },
      });

      expect(defender).toMatchObject({
        id: DEFENDER_ID,
        cell: defenderCell,
        movement: { mode: "idle" },
        combat: { damage: 10 },
      });
      expect(attacker).toMatchObject({
        id: ATTACKER_ID,
        cell: attackerStart,
        movement: { mode: "idle" },
      });
      return { scenario, defenderCell, attackerStart, attackerDest };
    },
  );

  await test.step("Cuando el defensor recibe hold-position y el agresor orden de avance", async () => {
    const hold = await game.issueOrder(DEFENDER_ID, { type: "hold-position" });
    expect(hold).toMatchObject({
      unitId: DEFENDER_ID,
      type: "hold-position",
      status: "running",
    });

    const attackOrder = await game.issueOrder(ATTACKER_ID, {
      type: "move",
      destination: setup.attackerDest,
    });
    expect(attackOrder).toMatchObject({
      unitId: ATTACKER_ID,
      type: "move",
      status: "running",
      destination: setup.attackerDest,
    });
  });

  let afterSequence = 0;

  await test.step("Entonces el agresor avanza hacia el defensor", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: {
        type: "unit-entered-cell",
        unitId: ATTACKER_ID,
        cell: { col: 1, row: 0 },
      },
    });
    afterSequence = result.matchedEvent.sequence;
    expect(getUnit(result.snapshot, ATTACKER_ID)).toMatchObject({
      movement: { mode: "moving" },
    });
    expect(result.snapshot.errors).toEqual([]);
  });

  await test.step("Y se produce daño sin que el defensor se mueva de su posición", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "damage.applied" },
      maxFrames: 200,
    });
    afterSequence = result.matchedEvent.sequence;
    expect(result.matchedEvent.type).toBe("damage.applied");
    expect(getUnit(result.snapshot, DEFENDER_ID)).toMatchObject({
      cell: setup.defenderCell,
      movement: { mode: "holding" },
      order: { type: "hold-position", status: "running" },
    });
    expect(result.snapshot.errors).toEqual([]);
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
