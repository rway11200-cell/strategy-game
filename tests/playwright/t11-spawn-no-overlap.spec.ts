import { expect, test } from "./support/GameTestFixture";

const UNIT_A = "unit-a";
const UNIT_B = "unit-b";

test("dos unidades ocupan celdas distintas sin solaparse", async ({ game }) => {
  const setup = await test.step("Dado un grid con celdas libres contiguas", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("spawn-collision-grid");
    const cellA = game.point(scenario, "cellA");
    const cellB = game.point(scenario, "cellB");
    return { scenario, cellA, cellB };
  });

  await test.step("Cuando spawneo dos unidades en celdas diferentes", async () => {
    const unitA = await game.spawnUnit({
      scenarioId: setup.scenario.id,
      id: UNIT_A,
      archetype: "goblin",
      team: "enemy",
      cell: setup.cellA,
    });
    const unitB = await game.spawnUnit({
      scenarioId: setup.scenario.id,
      id: UNIT_B,
      archetype: "goblin",
      team: "enemy",
      cell: setup.cellB,
    });

    expect(unitA).toMatchObject({
      id: UNIT_A,
      cell: setup.cellA,
      occupiedCells: [setup.cellA],
      active: true,
    });
    expect(unitB).toMatchObject({
      id: UNIT_B,
      cell: setup.cellB,
      occupiedCells: [setup.cellB],
      active: true,
    });
  });

  await test.step("Entonces no comparten ninguna celda ocupada", async () => {
    const snapshot = await game.snapshot(setup.scenario.id);
    const occupiedCells = snapshot.cells.filter((cell) => cell.occupied);
    expect(occupiedCells).toHaveLength(2);
    expect(occupiedCells.map((cell) => cell.occupantId).sort()).toEqual([UNIT_A, UNIT_B]);
    expect(snapshot.errors).toEqual([]);
  });
});

test("spawnear en celda ocupada redirige a la celda libre más cercana", async ({ game }) => {
  const setup = await test.step("Dado una celda ya ocupada", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("spawn-collision-grid");
    const cellA = game.point(scenario, "cellA");

    await game.spawnUnit({
      scenarioId: scenario.id,
      id: UNIT_A,
      archetype: "goblin",
      team: "enemy",
      cell: cellA,
    });
    return { scenario, cellA };
  });

  await test.step("Cuando intento spawnear otra en la misma celda", async () => {
    const unitB = await game.spawnUnit({
      scenarioId: setup.scenario.id,
      id: UNIT_B,
      archetype: "goblin",
      team: "enemy",
      cell: setup.cellA,
    });

    expect(unitB).toMatchObject({
      id: UNIT_B,
      active: true,
    });
    expect(unitB.cell).not.toEqual(setup.cellA);

    const snapshot = await game.snapshot(setup.scenario.id);
    const occupantIds = snapshot.cells
      .filter((cell) => cell.occupied)
      .map((cell) => cell.occupantId)
      .sort();
    expect(occupantIds).toEqual([UNIT_A, UNIT_B]);

    const uniqueOccupants = new Set(snapshot.cells.filter((cell) => cell.occupied).map((c) => c.occupantId));
    expect(uniqueOccupants.size).toBe(2);
    expect(snapshot.errors).toEqual([]);
  });
});
