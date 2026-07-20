import type { CellCoord } from "../../src/grid/GridConfig";
import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const UNIT_ID = "patrol-unit";

function formatCell(cell: CellCoord): string {
  return `(${cell.col}, ${cell.row})`;
}

test("una unidad patrulla A -> B -> A y comienza un nuevo ciclo", async ({ game }) => {
  const setup = await test.step("Dado un corredor aislado con una unidad en A", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("three-cell-patrol-corridor");
    const pointA = game.point(scenario, "start");
    const intermediate = game.point(scenario, "intermediate");
    const pointB = game.point(scenario, "end");
    const unit = await game.spawnUnit({
      scenarioId: scenario.id,
      id: UNIT_ID,
      archetype: "goblin",
      team: "enemy",
      cell: pointA,
    });

    expect(unit).toMatchObject({
      id: UNIT_ID,
      active: true,
      cell: pointA,
      occupiedCells: [pointA],
      order: null,
    });
    return { scenario, pointA, intermediate, pointB };
  });

  const order = await test.step("Cuando recibe una orden de patrulla A <-> B", async () => {
    const issued = await game.issueOrder(UNIT_ID, {
      type: "patrol",
      endpoints: [setup.pointA, setup.pointB],
    });
    expect(issued).toMatchObject({
      unitId: UNIT_ID,
      type: "patrol",
      status: "running",
      endpoints: [setup.pointA, setup.pointB],
      completedCycles: 0,
    });
    return issued;
  });

  await test.step("Entonces completa un ciclo y conserva la misma orden", async () => {
    const expected = [
      [setup.pointA, setup.intermediate, "ida por el punto intermedio"],
      [setup.intermediate, setup.pointB, "llegada a B"],
      [setup.pointB, setup.intermediate, "regreso por el punto intermedio"],
      [setup.intermediate, setup.pointA, "regreso a A"],
      [setup.pointA, setup.intermediate, "inicio del siguiente ciclo"],
    ] as const;
    let afterSequence = 0;

    for (const [from, to, label] of expected) {
      await test.step(`${label}: ${formatCell(from)} -> ${formatCell(to)}`, async () => {
        const result = await game.advanceUntil({
          scenarioId: setup.scenario.id,
          afterSequence,
          condition: { type: "unit-entered-cell", unitId: UNIT_ID, cell: to },
        });
        afterSequence = result.matchedEvent.sequence;

        expect(result.matchedEvent).toMatchObject({ unitId: UNIT_ID, from, to });
        expect(getUnit(result.snapshot, UNIT_ID)).toMatchObject({
          cell: to,
          occupiedCells: [to],
          order: { id: order.id, type: "patrol", status: "running" },
        });
        expect(result.snapshot.cells.filter((cell) => cell.occupied)).toEqual([
          expect.objectContaining({ cell: to, occupantId: UNIT_ID }),
        ]);
        expect(result.snapshot.errors).toEqual([]);
      });
    }

    const final = await game.snapshot(setup.scenario.id);
    expect(getUnit(final, UNIT_ID).order).toMatchObject({
      id: order.id,
      status: "running",
      completedCycles: 1,
    });
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
