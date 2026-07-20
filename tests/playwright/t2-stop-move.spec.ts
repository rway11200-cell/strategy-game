import { expect, test } from "@playwright/test";
import { GameTestDriver, getUnit } from "./support/GameTestDriver";

const UNIT_ID = "stoppable-unit";

test("stop cancela un movimiento y mantiene la última celda confirmada", async ({ page }) => {
  const game = new GameTestDriver(page);

  const setup = await test.step("Dado una unidad en un corredor largo", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("long-movement-corridor");
    const origin = game.point(scenario, "origin");
    const checkpoint = game.point(scenario, "checkpoint");
    const destination = game.point(scenario, "destination");
    const unit = await game.spawnUnit({
      scenarioId: scenario.id,
      id: UNIT_ID,
      archetype: "goblin",
      team: "player",
      cell: origin,
    });

    expect(unit).toMatchObject({
      cell: origin,
      occupiedCells: [origin],
      movement: { mode: "idle" },
    });
    return { scenario, checkpoint, destination };
  });

  const move = await test.step("Cuando comienza a moverse hacia el destino", async () => {
    const order = await game.issueOrder(UNIT_ID, {
      type: "move",
      destination: setup.destination,
    });
    expect(order).toMatchObject({
      type: "move",
      status: "running",
      destination: setup.destination,
    });

    const progressed = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "unit-entered-cell", unitId: UNIT_ID, cell: setup.checkpoint },
    });
    expect(getUnit(progressed.snapshot, UNIT_ID)).toMatchObject({
      cell: setup.checkpoint,
      occupiedCells: [setup.checkpoint],
      movement: { mode: "moving" },
      order: { id: order.id, status: "running" },
    });
    return order;
  });

  await test.step("Y recibe stop antes de llegar", async () => {
    const stop = await game.issueOrder(UNIT_ID, { type: "stop" });
    const snapshot = await game.snapshot(setup.scenario.id);

    expect(snapshot.orders.find((order) => order.id === move.id)).toMatchObject({
      status: "cancelled",
      finishedAtFrame: expect.any(Number),
    });
    expect(stop).toMatchObject({ type: "stop", status: "completed" });
    expect(getUnit(snapshot, UNIT_ID)).toMatchObject({
      cell: setup.checkpoint,
      occupiedCells: [setup.checkpoint],
      movement: { mode: "stopped", route: [], targetCell: null, stepProgress: 0 },
      combat: { mode: "disabled" },
      order: null,
    });
  });

  await test.step("Entonces permanece detenido aunque avance la simulación", async () => {
    const before = getUnit(await game.snapshot(setup.scenario.id), UNIT_ID);
    const after = getUnit(await game.advanceFrames(setup.scenario.id, 20), UNIT_ID);

    expect(after.cell).toEqual(before.cell);
    expect(after.world).toEqual(before.world);
    expect(after.occupiedCells).toEqual(before.occupiedCells);
    expect(after.cell).not.toEqual(setup.destination);
  });
});
