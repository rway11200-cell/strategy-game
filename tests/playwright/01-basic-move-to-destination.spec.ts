import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const UNIT_ID = "blue-warrior";

function formatCell(cell: { col: number; row: number }): string {
  return `(${cell.col}, ${cell.row})`;
}

test("un guerrero avanza celda por celda hasta completar la ruta", async ({ game }) => {
  const setup = await test.step("Dado un guerrero en (0,0) en un corredor de 5 celdas", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("warrior-march");
    const origin = game.point(scenario, "origin");
    const destination = game.point(scenario, "destination");

    const unit = await game.spawnUnit({
      scenarioId: scenario.id,
      id: UNIT_ID,
      archetype: "warrior",
      team: "player",
      cell: origin,
    });

    expect(unit).toMatchObject({
      id: UNIT_ID,
      active: true,
      cell: origin,
      occupiedCells: [origin],
      order: null,
    });
    return { scenario, origin, destination };
  });

  const order = await test.step("Cuando recibe orden de moverse de (0,0) a (4,0)", async () => {
    const issued = await game.issueOrder(UNIT_ID, {
      type: "move",
      destination: setup.destination,
    });

    expect(issued).toMatchObject({
      unitId: UNIT_ID,
      type: "move",
      status: "running",
      destination: setup.destination,
    });
    return issued;
  });

  const expectedCells = [
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 3, row: 0 },
    { col: 4, row: 0 },
  ];

  let afterSequence = 0;

  for (const [index, targetCell] of expectedCells.entries()) {
    const label =
      index < expectedCells.length - 1
        ? `avanza a ${formatCell(targetCell)}`
        : `llega al destino ${formatCell(targetCell)}`;

    await test.step(`Entonces ${label}`, async () => {
      const result = await game.advanceUntil({
        scenarioId: setup.scenario.id,
        afterSequence,
        condition: { type: "unit-entered-cell", unitId: UNIT_ID, cell: targetCell },
      });

      afterSequence = result.matchedEvent.sequence;
      expect(result.matchedEvent).toMatchObject({
        unitId: UNIT_ID,
        to: targetCell,
      });

      if (index < expectedCells.length - 1) {
        expect(getUnit(result.snapshot, UNIT_ID)).toMatchObject({
          cell: targetCell,
          occupiedCells: [targetCell],
          movement: { mode: "moving" },
          order: { id: order.id, status: "running" },
        });
      }
    });
  }

  await test.step("Y la orden se completa al alcanzar el destino", async () => {
    const snapshot = await game.snapshot(setup.scenario.id);
    expect(getUnit(snapshot, UNIT_ID)).toMatchObject({
      cell: setup.destination,
    });
    expect(snapshot.orders.find((o) => o.id === order.id)).toMatchObject({
      status: "completed",
      completionReason: "destination-reached",
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
