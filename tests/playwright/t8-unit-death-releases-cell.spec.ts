import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const UNIT_ID = "doomed-unit";
const REPLACEMENT_ID = "replacement-unit";

test("la muerte libera inmediatamente la celda para otra unidad", async ({ game }) => {
  const setup = await test.step("Dado una unidad viva ocupando una celda", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("single-unit-death");
    const cell = game.point(scenario, "unitCell");
    const unit = await game.spawnUnit({
      scenarioId: scenario.id,
      id: UNIT_ID,
      archetype: "goblin",
      team: "enemy",
      cell,
      stats: { hp: 50 },
    });
    expect(unit).toMatchObject({
      lifecycle: "alive",
      hp: 50,
      cell,
      occupiedCells: [cell],
    });
    return { scenario, cell };
  });

  await test.step("Cuando recibe exactamente su vida como daño", async () => {
    const result = await game.applyDamage({
      scenarioId: setup.scenario.id,
      targetId: UNIT_ID,
      amount: 50,
    });
    expect(result.event).toMatchObject({
      type: "damage.applied",
      targetId: UNIT_ID,
      amount: 50,
      hpBefore: 50,
      hpAfter: 0,
    });
  });

  await test.step("Entonces muere y libera la ocupación en el mismo frame lógico", async () => {
    const died = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "unit-lifecycle", unitId: UNIT_ID, lifecycle: "dead" },
    });
    expect(getUnit(died.snapshot, UNIT_ID)).toMatchObject({
      lifecycle: "dead",
      hp: 0,
      occupiedCells: [],
    });
    expect(
      died.snapshot.cells.find(
        (cell) => cell.cell.col === setup.cell.col && cell.cell.row === setup.cell.row,
      ),
    ).toMatchObject({
      occupied: false,
      occupantId: null,
    });
    expect(died.snapshot.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "unit.died", unitId: UNIT_ID }),
        expect.objectContaining({ type: "occupation.released", unitId: UNIT_ID, cell: setup.cell }),
      ]),
    );
  });

  await test.step("Y una nueva unidad puede reutilizar esa misma celda", async () => {
    const replacement = await game.spawnUnit({
      scenarioId: setup.scenario.id,
      id: REPLACEMENT_ID,
      archetype: "goblin",
      team: "enemy",
      cell: setup.cell,
    });
    expect(replacement).toMatchObject({
      id: REPLACEMENT_ID,
      lifecycle: "alive",
      cell: setup.cell,
      occupiedCells: [setup.cell],
    });
  });
});
