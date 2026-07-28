import { expect, test } from "./support/GameTestFixture";
import { eventsOfType, getUnit } from "./support/GameTestDriver";

const PURSUER_ID = "free-pursuer";
const RUNNER_ID = "moving-runner";

test("un guerrero persigue automáticamente a un enemigo que entra en su visión", async ({
  game,
}) => {
  const setup = await test.step(
    "Dado un perseguidor y un corredor inicialmente fuera de su visión",
    async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("warrior-pursuit-square");
      const pursuerCell = game.point(scenario, "pursuer");
      const runnerStart = game.point(scenario, "runnerOutOfVision");
      const runnerVisible = game.point(scenario, "runnerVisible");
      const runnerDestination = game.point(scenario, "runnerDestination");

      const pursuer = await game.spawnUnit({
        scenarioId: scenario.id,
        id: PURSUER_ID,
        archetype: "warrior",
        team: "player",
        cell: pursuerCell,
        stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 60 },
      });
      const runner = await game.spawnUnit({
        scenarioId: scenario.id,
        id: RUNNER_ID,
        archetype: "warrior",
        team: "enemy",
        cell: runnerStart,
        stats: { hp: 200, movementFramesPerCell: 60 },
      });

      expect(pursuer).toMatchObject({
        id: PURSUER_ID,
        cell: pursuerCell,
        combat: { damage: 10, mode: "auto" },
      });
      expect(runner).toMatchObject({
        id: RUNNER_ID,
        cell: runnerStart,
        movement: { mode: "idle" },
      });
      await game.issueOrder(RUNNER_ID, { type: "move", destination: runnerDestination });
      return { scenario, pursuerCell, runnerVisible };
    },
  );

  let afterSequence = 0;

  await test.step("Cuando el corredor alcanza el borde de visión, el perseguidor aún no se ha movido", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "unit-entered-cell", unitId: RUNNER_ID, cell: setup.runnerVisible },
    });
    afterSequence = result.matchedEvent.sequence;
    expect(getUnit(result.snapshot, PURSUER_ID)).toMatchObject({
      cell: setup.pursuerCell,
      movement: { targetCell: null, stepProgress: 0 },
    });
    expect(eventsOfType(result.snapshot, "damage.applied").filter((event) => event.sourceId === PURSUER_ID)).toEqual([]);
  });

  await test.step("Entonces comienza a perseguirlo sin recibir una orden", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "unit-entered-cell", unitId: PURSUER_ID, cell: { col: 4, row: 2 } },
    });
    afterSequence = result.matchedEvent.sequence;
    expect(getUnit(result.snapshot, PURSUER_ID)).toMatchObject({
      cell: { col: 4, row: 2 },
      activity: "pursuing",
      order: null,
    });
    expect(result.snapshot.errors).toEqual([]);
  });

  await test.step("Y al entrar en rango se detiene antes de adquirir y dañar al corredor", async () => {
    const acquired = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "target.acquired", unitId: PURSUER_ID, targetId: RUNNER_ID },
    });
    afterSequence = acquired.matchedEvent.sequence;
    expect(getUnit(acquired.snapshot, PURSUER_ID)).toMatchObject({
      activity: "attacking",
      movement: { targetCell: null, stepProgress: 0 },
      order: null,
    });

    const damaged = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence,
      condition: { type: "event", eventType: "damage.applied", sourceId: PURSUER_ID, targetId: RUNNER_ID },
    });
    expect(damaged.matchedEvent).toMatchObject({ amount: 10, hpBefore: 200, hpAfter: 190 });
    expect(getUnit(damaged.snapshot, PURSUER_ID)).toMatchObject({
      activity: "attacking",
      movement: { targetCell: null, stepProgress: 0 },
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
