import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const PURSUER_ID = "free-pursuer";
const RUNNER_ID = "moving-runner";

test("un guerrero persigue automáticamente a un enemigo sin recibir órdenes", async ({
  game,
}) => {
  const setup = await test.step(
    "Dado un perseguidor en (4,1) y un corredor en (4,6) en grid 9x9",
    async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("warrior-pursuit-square");
      const pursuerCell = game.point(scenario, "pursuer");
      const runnerCell = game.point(scenario, "runnerStart");

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
        cell: runnerCell,
        stats: { hp: 200 },
      });

      expect(pursuer).toMatchObject({
        id: PURSUER_ID,
        cell: pursuerCell,
        combat: { damage: 10, mode: "auto" },
      });
      expect(runner).toMatchObject({
        id: RUNNER_ID,
        cell: runnerCell,
        movement: { mode: "idle" },
      });
      return { scenario, pursuerCell, runnerCell };
    },
  );

  await test.step("Entonces el perseguidor se activa y puede alcanzar al corredor", async () => {
    const snapshot = await game.advanceFrames(setup.scenario.id, 200);
    const pursuer = getUnit(snapshot, PURSUER_ID);
    const runner = getUnit(snapshot, RUNNER_ID);
    expect(pursuer.active).toBe(true);
    expect(runner.active).toBe(true);
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
