import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const LEAD_ID = "lead-unit";
const TRAIL_ID = "trail-unit";

test("dos unidades en convoy hacia el mismo destino no se solapan y la seguidora se detiene cerca", async ({
  game,
}) => {
  const setup = await test.step(
    "Dado una unidad líder y otra detrás en la misma fila",
    async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("two-unit-convoy");
      const leadStart = game.point(scenario, "leadStart");
      const trailStart = game.point(scenario, "trailStart");
      const destination = game.point(scenario, "destination");

      const lead = await game.spawnUnit({
        scenarioId: scenario.id,
        id: LEAD_ID,
        archetype: "goblin",
        team: "player",
        cell: leadStart,
        stats: { movementFramesPerCell: 2 },
      });
      const trail = await game.spawnUnit({
        scenarioId: scenario.id,
        id: TRAIL_ID,
        archetype: "goblin",
        team: "player",
        cell: trailStart,
        stats: { movementFramesPerCell: 2 },
      });

      expect(lead).toMatchObject({
        id: LEAD_ID,
        cell: leadStart,
        active: true,
        movement: { mode: "idle" },
      });
      expect(trail).toMatchObject({
        id: TRAIL_ID,
        cell: trailStart,
        active: true,
        movement: { mode: "idle" },
      });
      return { scenario, destination };
    },
  );

  await test.step("Cuando ambas reciben orden de ir al mismo destino", async () => {
    const leadOrder = await game.issueOrder(LEAD_ID, {
      type: "move",
      destination: setup.destination,
    });
    expect(leadOrder).toMatchObject({
      unitId: LEAD_ID,
      type: "move",
      status: "running",
      destination: setup.destination,
    });

    const trailOrder = await game.issueOrder(TRAIL_ID, {
      type: "move",
      destination: setup.destination,
    });
    expect(trailOrder).toMatchObject({
      unitId: TRAIL_ID,
      type: "move",
      status: "running",
      destination: setup.destination,
    });
  });

  const advanced = await test.step("Entonces ambas avanzan y nunca comparten celda", async () => {
    const snapshot = await game.advanceFrames(setup.scenario.id, 60);
    const lead = getUnit(snapshot, LEAD_ID);
    const trail = getUnit(snapshot, TRAIL_ID);

    expect(lead.cell).not.toBeNull();
    expect(trail.cell).not.toBeNull();
    expect(lead.cell).not.toEqual(trail.cell);

    const leadOccupied = snapshot.cells.filter(
      (c) => c.occupied && c.occupantId === LEAD_ID,
    );
    const trailOccupied = snapshot.cells.filter(
      (c) => c.occupied && c.occupantId === TRAIL_ID,
    );
    expect(leadOccupied).toHaveLength(1);
    expect(trailOccupied).toHaveLength(1);
    expect(leadOccupied[0].cell).not.toEqual(trailOccupied[0].cell);

    expect(snapshot.errors).toEqual([]);
    return snapshot;
  });

  await test.step("Y la seguidora se detiene como máximo a 2 celdas de la líder", async () => {
    const lead = getUnit(advanced, LEAD_ID);
    const trail = getUnit(advanced, TRAIL_ID);

    const distance =
      Math.abs(lead.cell!.col - trail.cell!.col) +
      Math.abs(lead.cell!.row - trail.cell!.row);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThanOrEqual(3);

    const leadOrder = advanced.orders.find((o) => o.unitId === LEAD_ID);
    const trailOrder = advanced.orders.find((o) => o.unitId === TRAIL_ID);
    expect(leadOrder).toBeDefined();
    expect(trailOrder).toBeDefined();
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
