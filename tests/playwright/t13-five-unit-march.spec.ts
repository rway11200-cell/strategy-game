import { expect, test } from "./support/GameTestFixture";

const UNIT_IDS = Array.from({ length: 5 }, (_, i) => `march-unit-${i + 1}`);

test("cinco unidades marchan del mismo punto al destino sin solaparse", async ({ game }) => {
  const setup = await test.step("Dado cinco unidades desde la columna izquierda", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("five-unit-march");
    const spawnCells = game.group(scenario, "spawnCells");
    const destination = game.point(scenario, "destination");

    expect(spawnCells).toHaveLength(UNIT_IDS.length);

    for (const [index, unitId] of UNIT_IDS.entries()) {
      const unit = await game.spawnUnit({
        scenarioId: scenario.id,
        id: unitId,
        archetype: "goblin",
        team: "player",
        cell: spawnCells[index],
        stats: { movementFramesPerCell: 3 },
      });
      expect(unit).toMatchObject({ id: unitId, active: true });
      expect(unit.cell).not.toBeNull();
    }

    return { scenario, destination };
  });

  await test.step("Cuando todas reciben orden de ir al destino", async () => {
    for (const unitId of UNIT_IDS) {
      const order = await game.issueOrder(unitId, {
        type: "move",
        destination: setup.destination,
      });
      expect(order).toMatchObject({
        unitId,
        type: "move",
        status: "running",
        destination: setup.destination,
      });
    }
  });

  await test.step("Entonces avanzan hasta que todas llegan o se detienen", async () => {
    let snapshot = await game.snapshot(setup.scenario.id);

    for (let attempt = 0; attempt < 30; attempt++) {
      snapshot = await game.advanceFrames(setup.scenario.id, 5);
      const running = snapshot.orders.filter(
        (o) => UNIT_IDS.includes(o.unitId) && o.status === "running",
      );
      if (running.length === 0) break;
    }

    const dest = setup.destination;
    const atDest = snapshot.units.filter(
      (u) => u.cell && u.cell.col === dest.col && u.cell.row === dest.row,
    );
    expect(atDest.length).toBeGreaterThanOrEqual(1);

    const occupied = snapshot.cells.filter(
      (c) => c.occupied && UNIT_IDS.includes(c.occupantId!),
    );
    expect(occupied).toHaveLength(UNIT_IDS.length);
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
