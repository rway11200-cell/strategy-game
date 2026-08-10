import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const DEFENDER_ID = "square-holder";
const ATTACKER_ID = "square-passer";

test("un guerrero en hold-position en grid grande repele al agresor sin moverse", async ({
  game,
}) => {
  const setup = await test.step(
    "Dado un defensor en el centro (4,4) y un agresor en (0,4) en grid 9x9",
    async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("warrior-hold-square");
      const defenderCell = game.point(scenario, "defender");
      const attackerStart = game.point(scenario, "attackerStart");
      const attackerDest = game.point(scenario, "attackerDestination");

      expect(scenario.grid).toMatchObject({ columns: 9, rows: 9 });

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
        combat: { damage: 10 },
      });
      expect(attacker).toMatchObject({
        id: ATTACKER_ID,
        cell: attackerStart,
      });
      return { scenario, defenderCell, attackerStart, attackerDest };
    },
  );

  const hold = await test.step("Cuando el defensor recibe hold-position y el agresor orden de cruzar", async () => {
    const holdOrder = await game.issueOrder(DEFENDER_ID, { type: "hold-position" });
    expect(holdOrder).toMatchObject({
      unitId: DEFENDER_ID,
      type: "hold-position",
      status: "running",
    });

    const moveOrder = await game.issueOrder(ATTACKER_ID, {
      type: "move",
      destination: setup.attackerDest,
    });
    expect(moveOrder).toMatchObject({
      unitId: ATTACKER_ID,
      type: "move",
      status: "running",
      destination: setup.attackerDest,
    });
    return holdOrder;
  });

  let afterSequence = 0;

  await test.step("Entonces el agresor avanza a través del grid", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: {
        type: "unit-entered-cell",
        unitId: ATTACKER_ID,
        cell: { col: 2, row: 4 },
      },
    });
    afterSequence = result.matchedEvent.sequence;
    expect(getUnit(result.snapshot, ATTACKER_ID)).toMatchObject({
      movement: { mode: "moving" },
    });
    expect(result.snapshot.errors).toEqual([]);
  });

  await test.step("Y se produce daño sin que el defensor se mueva de (4,4)", async () => {
    const damaged = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "damage.applied" },
      maxFrames: 200,
    });
    expect(damaged.matchedEvent.type).toBe("damage.applied");
    expect(getUnit(damaged.snapshot, DEFENDER_ID)).toMatchObject({
      cell: setup.defenderCell,
      movement: { mode: "holding" },
      order: { id: hold.id, status: "running" },
    });
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
