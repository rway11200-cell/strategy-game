import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const UNIT_IDS = ["follower-0", "follower-1", "follower-2"];

function coordKey(cell: { col: number; row: number }): string {
  return `${cell.col},${cell.row}`;
}

test("tres unidades desde la misma celda marchan sin solaparse", async ({ game }) => {
  const setup = await test.step("Dado tres skeletons en la misma celda de origen", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("follow-the-leader");
    const start = game.point(scenario, "start");
    const destination = game.point(scenario, "destination");

    for (const unitId of UNIT_IDS) {
      const unit = await game.spawnUnit({
        scenarioId: scenario.id,
        id: unitId,
        archetype: "skeleton",
        team: "enemy",
        cell: start,
      });
      expect(unit).toMatchObject({
        id: unitId,
        active: true,
      });
      expect(unit.occupiedCells).toHaveLength(1);
      const uniqueKeys = new Set<string>();
      for (const oc of unit.occupiedCells) {
        uniqueKeys.add(coordKey(oc));
      }
      expect(uniqueKeys.size).toBe(1);
    }

    const snapshot = await game.snapshot(scenario.id);
    expect(snapshot.cells.filter((cell) => cell.occupantId !== null)).toHaveLength(UNIT_IDS.length);
    expect(snapshot.errors).toEqual([]);
    return { scenario, start, destination };
  });

  await test.step("Cuando las tres reciben orden de ir al mismo destino", async () => {
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

  await test.step("Entonces avanzan sin solaparse y la líder alcanza el destino", async () => {
    const snapshot = await game.advanceFrames(setup.scenario.id, 400);
    const lead = getUnit(snapshot, "follower-0");

    expect(lead.cell?.col).toBeGreaterThanOrEqual(1);

    const allKeys = new Set<string>();
    for (const unitId of UNIT_IDS) {
      const unit = getUnit(snapshot, unitId);
      if (!unit.active) continue;
      const cells = snapshot.cells.filter((c) => c.occupantId === unitId);
      expect(cells).toHaveLength(1);
      const key = coordKey(cells[0].cell);
      expect(allKeys.has(key)).toBe(false);
      allKeys.add(key);
    }

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
