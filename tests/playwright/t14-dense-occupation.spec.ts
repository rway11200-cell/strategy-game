import { expect, test } from "./support/GameTestFixture";

const UNIT_COUNT = 9;
const UNIT_IDS = Array.from({ length: UNIT_COUNT }, (_, i) => `skeleton-${i}`);

function coordKey(cell: { col: number; row: number }): string {
  return `${cell.col},${cell.row}`;
}

test("9 skeletons spawnean en un bloque 3x3 sin solaparse", async ({ game }) => {
  const setup = await test.step("Dado un grid 8x8 con 9 celdas de spawn", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("dense-occupation");
    const spawnCells = game.group(scenario, "spawnCells");
    expect(spawnCells).toHaveLength(UNIT_COUNT);
    return { scenario, spawnCells };
  });

  await test.step("Cuando los 9 skeletons spawnean", async () => {
    for (let i = 0; i < UNIT_COUNT; i++) {
      const unit = await game.spawnUnit({
        scenarioId: setup.scenario.id,
        id: UNIT_IDS[i],
        archetype: "skeleton",
        team: "enemy",
        cell: setup.spawnCells[i],
      });
      expect(unit).toMatchObject({ id: UNIT_IDS[i], active: true });
      expect(unit.occupiedCells).toHaveLength(1);
      expect(unit.occupiedCells[0]).toEqual(setup.spawnCells[i]);
    }
  });

  await test.step("Entonces el grid tiene exactamente 9 celdas ocupadas sin overlap", async () => {
    const snapshot = await game.snapshot(setup.scenario.id);
    const occupied = snapshot.cells.filter((c) => c.occupied);
    expect(occupied).toHaveLength(UNIT_COUNT);
    expect(new Set(occupied.map((c) => coordKey(c.cell))).size).toBe(UNIT_COUNT);
    expect(new Set(occupied.map((c) => c.occupantId)).size).toBe(UNIT_COUNT);
    expect(snapshot.errors).toEqual([]);
  });
});

test("9 skeletons se mueven a (7,7) sin solaparse", async ({ game }) => {
  const setup = await test.step("Dado 9 skeletons spawneados en bloque 3x3", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("dense-occupation");
    const spawnCells = game.group(scenario, "spawnCells");
    const destination = game.point(scenario, "destination");

    for (let i = 0; i < UNIT_COUNT; i++) {
      await game.spawnUnit({
        scenarioId: scenario.id,
        id: UNIT_IDS[i],
        archetype: "skeleton",
        team: "enemy",
        cell: spawnCells[i],
        stats: { movementFramesPerCell: 3 },
      });
    }

    return { scenario, destination };
  });

  await test.step("Cuando las 9 reciben orden de ir a (7,7)", async () => {
    for (const unitId of UNIT_IDS) {
      const order = await game.issueOrder(unitId, {
        type: "move",
        destination: setup.destination,
      });
      expect(order).toMatchObject({ unitId, type: "move", status: "running" });
    }
  });

  await test.step("Entonces cada una ocupa exactamente 1 celda y nunca se solapan", async () => {
    let snapshot = await game.snapshot(setup.scenario.id);

    for (let frame = 0; frame < 100; frame++) {
      snapshot = await game.advanceFrames(setup.scenario.id, 1);

      const allKeys = new Set<string>();
      let hasOverlap = false;
      let allAlive = false;

      for (const unitId of UNIT_IDS) {
        const unit = snapshot.units.find((u) => u.id === unitId);
        if (!unit || !unit.active) continue;
        allAlive = true;

        const cells = snapshot.cells.filter((c) => c.occupantId === unitId);
        expect(cells.length).toBe(1);

        const key = coordKey(cells[0].cell);
        if (allKeys.has(key)) hasOverlap = true;
        allKeys.add(key);
      }

      if (!allAlive) break;
      expect(hasOverlap).toBe(false);
    }

    expect(snapshot.errors).toEqual([]);
  });
});
