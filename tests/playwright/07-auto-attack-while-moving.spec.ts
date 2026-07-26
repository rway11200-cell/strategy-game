import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const ATTACKER_ID = "moving-attacker";
const DEFENDER_ID = "stationary-defender";

test("un guerrero en movimiento ataca automáticamente a un enemigo en su ruta sin detenerse", async ({
  game,
}) => {
  const setup = await test.step(
    "Dado un atacante en movimiento y un defensor estático en su camino",
    async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("warrior-auto-move");
      const attackerStart = game.point(scenario, "attackerStart");
      const destination = game.point(scenario, "destination");
      const defenderCell = game.point(scenario, "defender");

      const attacker = await game.spawnUnit({
        scenarioId: scenario.id,
        id: ATTACKER_ID,
        archetype: "warrior",
        team: "player",
        cell: attackerStart,
        stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 60 },
      });
      const defender = await game.spawnUnit({
        scenarioId: scenario.id,
        id: DEFENDER_ID,
        archetype: "warrior",
        team: "enemy",
        cell: defenderCell,
        stats: { hp: 200 },
      });

      expect(attacker).toMatchObject({
        id: ATTACKER_ID,
        cell: attackerStart,
        movement: { mode: "idle" },
      });
      expect(defender).toMatchObject({
        id: DEFENDER_ID,
        cell: defenderCell,
        movement: { mode: "idle" },
      });
      return { scenario, attackerStart, destination, defenderCell };
    },
  );

  await test.step("Cuando el atacante recibe orden de moverse al otro extremo", async () => {
    const order = await game.issueOrder(ATTACKER_ID, {
      type: "move",
      destination: setup.destination,
    });
    expect(order).toMatchObject({
      unitId: ATTACKER_ID,
      type: "move",
      status: "running",
      destination: setup.destination,
    });
  });

  let afterSequence = 0;

  await test.step("Entonces se desplaza por el corredor", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: {
        type: "unit-entered-cell",
        unitId: ATTACKER_ID,
        cell: { col: 2, row: 0 },
      },
    });
    afterSequence = result.matchedEvent.sequence;
    expect(getUnit(result.snapshot, ATTACKER_ID)).toMatchObject({
      cell: { col: 2, row: 0 },
      movement: { mode: "moving" },
    });
    expect(result.snapshot.errors).toEqual([]);
  });

  await test.step("Y al pasar junto al defensor, puede infligir daño automáticamente", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "damage.applied", sourceId: ATTACKER_ID },
      maxFrames: 300,
    });
    afterSequence = result.matchedEvent.sequence;
    expect(result.matchedEvent).toMatchObject({
      type: "damage.applied",
      sourceId: ATTACKER_ID,
      targetId: DEFENDER_ID,
    });
    expect(result.snapshot.errors).toEqual([]);
  });

  await test.step("Y el atacante detiene su movimiento ante la celda ocupada por el defensor", async () => {
    const snapshot = await game.advanceFrames(setup.scenario.id, 200);
    const attacker = getUnit(snapshot, ATTACKER_ID);
    expect(attacker.cell).not.toBeNull();
    expect(getUnit(snapshot, DEFENDER_ID)).toMatchObject({
      cell: setup.defenderCell,
      active: true,
    });
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
