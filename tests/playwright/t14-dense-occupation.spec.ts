import { expect, test } from "./support/GameTestFixture";

const SKELETON_A = "skeleton-a";
const SKELETON_B = "skeleton-b";
const FOOTPRINT_SIZE = 1;

test("esqueleto ocupa 1 celda al spawnear", async ({ game }) => {
  const setup = await test.step("Dado un grid con espacio para skeleton", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("dense-occupation");
    const spawnA = game.point(scenario, "spawnA");
    return { scenario, spawnA };
  });

  await test.step("Cuando spawneo un skeleton", async () => {
    const unit = await game.spawnUnit({
      scenarioId: setup.scenario.id,
      id: SKELETON_A,
      archetype: "skeleton",
      team: "enemy",
      cell: setup.spawnA,
    });

    expect(unit).toMatchObject({
      id: SKELETON_A,
      cell: setup.spawnA,
      active: true,
    });
    expect(unit.occupiedCells).toHaveLength(FOOTPRINT_SIZE);
    expect(unit.occupiedCells).toContainEqual(setup.spawnA);
  });

  await test.step("Entonces el grid reporta exactamente 1 celda ocupada por el skeleton", async () => {
    const snapshot = await game.snapshot(setup.scenario.id);
    const skeletonCells = snapshot.cells.filter(
      (c) => c.occupantId === SKELETON_A,
    );
    expect(skeletonCells).toHaveLength(FOOTPRINT_SIZE);
    expect(skeletonCells[0].cell).toEqual(setup.spawnA);
  });
});

test("dos skeletons spawnean en el mismo punto y ocupan 2 celdas sin solaparse", async ({ game }) => {
  const setup = await test.step("Dado un grid con un punto de spawn", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("dense-occupation");
    const spawnA = game.point(scenario, "spawnA");
    return { scenario, spawnA };
  });

  await test.step("Cuando dos skeletons spawnean simultáneamente en la misma celda", async () => {
    const unitA = await game.spawnUnit({
      scenarioId: setup.scenario.id,
      id: SKELETON_A,
      archetype: "skeleton",
      team: "enemy",
      cell: setup.spawnA,
    });
    expect(unitA.cell).toEqual(setup.spawnA);
    expect(unitA.occupiedCells).toHaveLength(FOOTPRINT_SIZE);

    const unitB = await game.spawnUnit({
      scenarioId: setup.scenario.id,
      id: SKELETON_B,
      archetype: "skeleton",
      team: "enemy",
      cell: setup.spawnA,
    });

    expect(unitB).toMatchObject({ id: SKELETON_B, active: true });
    expect(unitB.cell).not.toEqual(setup.spawnA);
    expect(unitB.occupiedCells).toHaveLength(FOOTPRINT_SIZE);
  });

  await test.step("Entonces el grid tiene 4 celdas ocupadas, sin overlap de occupantIds", async () => {
    const snapshot = await game.snapshot(setup.scenario.id);
    const occupied = snapshot.cells.filter((c) => c.occupied);
    expect(occupied).toHaveLength(FOOTPRINT_SIZE * 2);

    const cellsByOccupant = new Map<string, typeof occupied>();
    for (const cell of occupied) {
      const list = cellsByOccupant.get(cell.occupantId!) ?? [];
      list.push(cell);
      cellsByOccupant.set(cell.occupantId!, list);
    }
    expect(cellsByOccupant.size).toBe(2);
    expect(cellsByOccupant.get(SKELETON_A)).toHaveLength(FOOTPRINT_SIZE);
    expect(cellsByOccupant.get(SKELETON_B)).toHaveLength(FOOTPRINT_SIZE);

    const allCoordKeys = new Set(occupied.map((c) => coordKey(c.cell)));
    expect(allCoordKeys.size).toBe(FOOTPRINT_SIZE * 2);
    expect(snapshot.errors).toEqual([]);
  });
});

test("dos skeletons se mueven manteniendo ocupación densa sin solaparse", async ({ game }) => {
  const setup = await test.step("Dado dos skeletons spawneados en el mismo punto", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("dense-occupation");
    const spawnA = game.point(scenario, "spawnA");
    const destination = game.point(scenario, "destination");

    await game.spawnUnit({
      scenarioId: scenario.id,
      id: SKELETON_A,
      archetype: "skeleton",
      team: "enemy",
      cell: spawnA,
      stats: { movementFramesPerCell: 3 },
    });
    await game.spawnUnit({
      scenarioId: scenario.id,
      id: SKELETON_B,
      archetype: "skeleton",
      team: "enemy",
      cell: spawnA,
      stats: { movementFramesPerCell: 3 },
    });

    return { scenario, destination };
  });

  await test.step("Cuando ambas reciben orden de ir al destino", async () => {
    for (const unitId of [SKELETON_A, SKELETON_B]) {
      const order = await game.issueOrder(unitId, {
        type: "move",
        destination: setup.destination,
      });
      expect(order).toMatchObject({ unitId, type: "move", status: "running" });
    }
  });

  await test.step("Entonces cada una ocupa exactamente 1 celda en cada frame y nunca se solapan", async () => {
    let snapshot = await game.snapshot(setup.scenario.id);

    for (let frame = 0; frame < 60; frame++) {
      snapshot = await game.advanceFrames(setup.scenario.id, 1);

      const aCells = snapshot.cells.filter((c) => c.occupantId === SKELETON_A);
      const bCells = snapshot.cells.filter((c) => c.occupantId === SKELETON_B);

      const aAlive = snapshot.units.find((u) => u.id === SKELETON_A)?.active ?? false;
      const bAlive = snapshot.units.find((u) => u.id === SKELETON_B)?.active ?? false;

      if (!aAlive && !bAlive) break;

      if (aAlive) {
        expect(
          aCells.length,
          `${SKELETON_A} must occupy exactly ${FOOTPRINT_SIZE} cells at frame ${snapshot.frame}`,
        ).toBe(FOOTPRINT_SIZE);
      }
      if (bAlive) {
        expect(
          bCells.length,
          `${SKELETON_B} must occupy exactly ${FOOTPRINT_SIZE} cells at frame ${snapshot.frame}`,
        ).toBe(FOOTPRINT_SIZE);
      }

      const aKeys = new Set(aCells.map((c) => coordKey(c.cell)));
      const bKeys = new Set(bCells.map((c) => coordKey(c.cell)));
      for (const key of aKeys) {
        expect(
          bKeys.has(key),
          `cell ${key} occupied by ${SKELETON_A} at frame ${snapshot.frame} but also claimed by ${SKELETON_B}`,
        ).toBe(false);
      }
    }

    expect(snapshot.errors).toEqual([]);
  });
});

function coordKey(cell: { col: number; row: number }): string {
  return `${cell.col},${cell.row}`;
}


