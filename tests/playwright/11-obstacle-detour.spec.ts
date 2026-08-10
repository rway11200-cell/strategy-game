import { expect, test } from "./support/GameTestFixture";
import { eventsOfType, getUnit } from "./support/GameTestDriver";

const UNIT_ID = "detour-unit";

test("una orden de movimiento esquiva una barrera bloqueada por su único paso", async ({ game }) => {
  const setup = await test.step("Dado un escenario con una barrera y un paso lateral", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("blocked-route-detour");
    const origin = game.point(scenario, "origin");
    const destination = game.point(scenario, "destination");
    const detourGate = game.point(scenario, "detourGate");

    const unit = await game.spawnUnit({
      scenarioId: scenario.id,
      id: UNIT_ID,
      archetype: "goblin",
      team: "player",
      cell: origin,
      stats: { movementFramesPerCell: 2 },
    });

    expect(unit).toMatchObject({ id: UNIT_ID, cell: origin, active: true });
    return { scenario, destination, detourGate };
  });

  await test.step("Cuando la unidad recibe una orden hacia el otro lado de la barrera", async () => {
    const order = await game.issueOrder(UNIT_ID, {
      type: "move",
      destination: setup.destination,
    });

    expect(order).toMatchObject({
      unitId: UNIT_ID,
      type: "move",
      status: "running",
      destination: setup.destination,
    });
  });

  const snapshot = await test.step("Entonces cruza por el paso y llega al destino", async () => {
    const snapshot = await game.advanceFrames(setup.scenario.id, 80);
    const unit = getUnit(snapshot, UNIT_ID);
    const order = snapshot.orders.find((candidate) => candidate.unitId === UNIT_ID);
    const transitions = eventsOfType(snapshot, "unit.entered-cell").filter(
      (event) => event.unitId === UNIT_ID,
    );

    expect(unit.cell).toEqual(setup.destination);
    expect(order).toMatchObject({
      status: "completed",
      destination: setup.destination,
      resolvedDestination: setup.destination,
      completionReason: "destination-reached",
    });
    expect(transitions.some((event) => event.to && event.to.col === setup.detourGate.col && event.to.row === setup.detourGate.row)).toBe(true);

    const blockedCells = snapshot.cells.filter((cell) => cell.type === "blocked");
    expect(blockedCells).toHaveLength(4);
    expect(blockedCells.every((cell) => !cell.occupied)).toBe(true);
    expect(snapshot.errors).toEqual([]);
    return snapshot;
  });

  await test.step("Y limpia el escenario sin ocupaciones residuales", async () => {
    const cleanup = await game.cleanup(setup.scenario.id);
    expect(cleanup).toMatchObject({
      remainingTestUnitIds: [],
      leakedOccupations: [],
      pendingOrderIds: [],
      pendingProjectileIds: [],
    });
    expect(snapshot.events.some((event) => event.type === "movement.destination-adjusted")).toBe(false);
  });
});
