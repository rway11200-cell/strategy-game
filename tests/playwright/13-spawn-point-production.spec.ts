import type { CellCoord } from "../../src/core/grid/GridConfig";
import { expect, test } from "./support/GameTestFixture";

const SPAWN_STRUCTURE_ID = "spawn-point";
const EXPECTED_INTERVAL_FRAMES = 90;
const MAX_PRODUCTIONS = 2;

test("un spawn point produce unidades periódicamente en celdas libres adyacentes", async ({
  game,
}) => {
  const setup = await test.step("Dado un spawn point en (1,1) con producción cada 90 frames", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("spawn-point-demo");
    const spawnPoint = game.point(scenario, "spawnPoint");

    expect(scenario.grid).toMatchObject({ columns: 7, rows: 7 });
    expect(spawnPoint).toEqual({ col: 1, row: 1 });

    const snapshot = await game.snapshot(scenario.id);
    expect(snapshot.errors).toEqual([]);
    return { scenario, spawnPoint };
  });

  const producedEvents: Array<{ unitId: string; cell: CellCoord; frame: number }> = [];
  let afterSeq = 0;

  await test.step("Cuando avanza hasta la primera producción", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "event", eventType: "unit.produced" },
      maxFrames: EXPECTED_INTERVAL_FRAMES,
    });

    expect(result.matchedEvent).toMatchObject({
      type: "unit.produced",
      sourceId: SPAWN_STRUCTURE_ID,
    });

    const unitId = result.matchedEvent.unitId!;
    const cell = result.matchedEvent.to!;
    expect(unitId).toMatch(/^spawn-point-unit-/);
    expect(cell.col).toBeGreaterThanOrEqual(0);
    expect(cell.row).toBeGreaterThanOrEqual(0);

    const unit = result.snapshot.units.find((u) => u.id === unitId);
    expect(unit).toMatchObject({
      id: unitId,
      active: true,
      cell,
      occupiedCells: [cell],
    });

    producedEvents.push({ unitId, cell, frame: result.snapshot.frame });
    afterSeq = result.matchedEvent.sequence;
    expect(result.snapshot.errors).toEqual([]);
  });

  await test.step("Entonces puede producir múltiples unidades en el tiempo correcto", async () => {
    let lastResult = null;
    for (let i = 1; i < MAX_PRODUCTIONS; i++) {
      const result = await game.advanceUntil({
        scenarioId: setup.scenario.id,
        afterSequence: afterSeq,
        condition: { type: "event", eventType: "unit.produced" },
        maxFrames: EXPECTED_INTERVAL_FRAMES * 3,
      });
      afterSeq = result.matchedEvent.sequence;

      expect(result.matchedEvent).toMatchObject({
        type: "unit.produced",
        sourceId: SPAWN_STRUCTURE_ID,
      });

      const unitId = result.matchedEvent.unitId!;
      const cell = result.matchedEvent.to!;

      const unit = result.snapshot.units.find((u) => u.id === unitId);
      expect(unit).toMatchObject({
        id: unitId,
        active: true,
        cell,
      });

      const frameGap = result.snapshot.frame - producedEvents[i - 1].frame;
      expect(frameGap).toBeGreaterThanOrEqual(EXPECTED_INTERVAL_FRAMES - 1);

      producedEvents.push({ unitId, cell, frame: result.snapshot.frame });
      lastResult = result;
    }

    expect(lastResult!.snapshot.errors).toEqual([]);
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
