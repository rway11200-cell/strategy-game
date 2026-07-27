import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const ATTACKER_ID = "moving-attacker";
const DEFENDER_ID = "stationary-defender";

test("un guerrero en attack-move se detiene para eliminar un enemigo y retoma su marcha", async ({
  game,
}) => {
  const setup = await test.step(
    "Dado un atacante y un defensor estático en un corredor",
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
        stats: { hp: 200, damage: 20, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 60 },
      });
      const defender = await game.spawnUnit({
        scenarioId: scenario.id,
        id: DEFENDER_ID,
        archetype: "warrior",
        team: "enemy",
        cell: defenderCell,
        stats: { hp: 40 },
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

  const order = await test.step("Cuando el atacante recibe una orden attack-move al otro extremo", async () => {
    const order = await game.issueOrder(ATTACKER_ID, {
      type: "attack-move",
      destination: setup.destination,
    });
    expect(order).toMatchObject({
      unitId: ATTACKER_ID,
      type: "attack-move",
      status: "running",
      destination: setup.destination,
    });
    return order;
  });

  let afterSequence = 0;

  await test.step("Entonces se acerca hasta el borde de su rango", async () => {
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

  await test.step("Y se detiene para dañar al defensor sin ocupar su celda", async () => {
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
      amount: 20,
    });
    expect(getUnit(result.snapshot, ATTACKER_ID)).toMatchObject({ cell: { col: 3, row: 0 } });
    expect(getUnit(result.snapshot, DEFENDER_ID)).toMatchObject({ hp: 20, cell: setup.defenderCell });
    expect(result.snapshot.errors).toEqual([]);
  });

  const defenderDeath = await test.step("Y elimina al defensor y libera su celda", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "unit.died", unitId: DEFENDER_ID },
    });
    afterSequence = result.matchedEvent.sequence;
    expect(result.snapshot.cells.find((cell) => cell.cell.col === 4 && cell.cell.row === 0)).toMatchObject({
      occupied: false,
      occupantId: null,
    });
    expect(result.snapshot.errors).toEqual([]);
    return result;
  });

  await test.step("Y retoma la marcha hasta completar la orden", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "unit-entered-cell", unitId: ATTACKER_ID, cell: setup.destination },
    });
    expect(getUnit(result.snapshot, ATTACKER_ID)).toMatchObject({
      cell: setup.destination,
    });
    expect(result.snapshot.orders.find((candidate) => candidate.id === order.id)).toMatchObject({
      status: "completed",
      completionReason: "destination-reached",
    });
    expect(defenderDeath.matchedEvent).toMatchObject({ unitId: DEFENDER_ID });
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
