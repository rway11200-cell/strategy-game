import { expect, test } from "@playwright/test";
import { GameTestDriver } from "./support/GameTestDriver";

const UNIT_IDS = Array.from({ length: 5 }, (_, index) => `patrol-${index + 1}`);

test("cinco patrullas resuelven la contención sin colisiones ni starvation", async ({ page }) => {
  const game = new GameTestDriver(page);

  const setup =
    await test.step("Dado cinco unidades ante un cuello de botella compartido", async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("five-unit-contended-patrol", { seed: 1 });
      const spawnCells = game.group(scenario, "spawnCells");
      const pointA = game.point(scenario, "pointA");
      const pointB = game.point(scenario, "pointB");
      expect(spawnCells).toHaveLength(UNIT_IDS.length);

      for (const [index, unitId] of UNIT_IDS.entries()) {
        await game.spawnUnit({
          scenarioId: scenario.id,
          id: unitId,
          archetype: "goblin",
          team: "enemy",
          cell: spawnCells[index],
        });
      }
      const initial = await game.snapshot(scenario.id);
      expect(initial.units.map((unit) => unit.id).sort()).toEqual([...UNIT_IDS].sort());
      expect(initial.cells.filter((cell) => cell.occupied)).toHaveLength(UNIT_IDS.length);
      return { scenario, pointA, pointB };
    });

  await test.step("Cuando todas reciben la misma ruta de patrulla", async () => {
    for (const unitId of UNIT_IDS) {
      const order = await game.issueOrder(unitId, {
        type: "patrol",
        endpoints: [setup.pointA, setup.pointB],
      });
      expect(order).toMatchObject({ unitId, type: "patrol", status: "running" });
    }
  });

  await test.step("Entonces todas progresan y cada bloqueo temporal se resuelve", async () => {
    const progressed = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: {
        type: "all-units-progressed",
        unitIds: UNIT_IDS,
        minimumTransitions: 4,
      },
      maxFrames: 2_000,
    });

    for (const unitId of UNIT_IDS) {
      const transitions = progressed.snapshot.events.filter(
        (event) => event.type === "unit.entered-cell" && event.unitId === unitId,
      );
      const blocked = progressed.snapshot.events.filter(
        (event) => event.type === "movement.blocked" && event.unitId === unitId,
      );
      const resumed = progressed.snapshot.events.filter(
        (event) => event.type === "movement.resumed" && event.unitId === unitId,
      );

      expect(transitions, `${unitId} must make progress`).toHaveLength(4);
      expect(resumed.length, `${unitId} must resume every temporary block`).toBeGreaterThanOrEqual(
        blocked.length,
      );
      expect(progressed.snapshot.orders.find((order) => order.unitId === unitId)).toMatchObject({
        type: "patrol",
        status: "running",
      });
    }
    expect(
      progressed.snapshot.events.filter((event) => event.type === "collision.detected"),
    ).toEqual([]);
    expect(progressed.snapshot.cells.filter((cell) => cell.occupied)).toHaveLength(UNIT_IDS.length);
    expect(progressed.snapshot.errors).toEqual([]);
  });
});
