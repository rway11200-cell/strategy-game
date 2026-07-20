import { expect, test } from "@playwright/test";
import { GameTestDriver, getUnit } from "./support/GameTestDriver";

const ATTACKER_ID = "holding-attacker";
const TARGET_ID = "stationary-target";

test("hold-position permite atacar un enemigo en rango sin moverse", async ({ page }) => {
  const game = new GameTestDriver(page);

  const setup =
    await test.step("Dado una atacante y un enemigo estacionario en rango", async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("hold-fire-stationary", { friendlyFire: false });
      const attackerCell = game.point(scenario, "attacker");
      const targetCell = game.point(scenario, "target");
      const attacker = await game.spawnUnit({
        scenarioId: scenario.id,
        id: ATTACKER_ID,
        archetype: "test-ranged-unit",
        team: "player",
        cell: attackerCell,
        stats: { damage: 20, rangeCells: 3, fireCooldownFrames: 1 },
      });
      const target = await game.spawnUnit({
        scenarioId: scenario.id,
        id: TARGET_ID,
        archetype: "goblin",
        team: "enemy",
        cell: targetCell,
        stats: { hp: 100 },
      });

      expect(attacker.combat.rangeCells).toBeGreaterThanOrEqual(2);
      expect(target.hp).toBe(100);
      return { scenario, attacker };
    });

  const hold = await test.step("Cuando la atacante recibe hold-position", async () => {
    return game.issueOrder(ATTACKER_ID, { type: "hold-position" });
  });

  await test.step("Entonces daña al enemigo sin cambiar de posición", async () => {
    const result = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "event", eventType: "damage.applied", targetId: TARGET_ID },
    });

    expect(result.matchedEvent).toMatchObject({
      type: "damage.applied",
      sourceId: ATTACKER_ID,
      targetId: TARGET_ID,
      amount: 20,
      hpBefore: 100,
      hpAfter: 80,
    });
    expect(getUnit(result.snapshot, ATTACKER_ID)).toMatchObject({
      cell: setup.attacker.cell,
      world: setup.attacker.world,
      occupiedCells: setup.attacker.occupiedCells,
      movement: { mode: "holding" },
      order: { id: hold.id, status: "running" },
    });
    expect(getUnit(result.snapshot, TARGET_ID).hp).toBe(80);
    expect(
      result.snapshot.events.filter(
        (event) => event.type === "unit.entered-cell" && event.unitId === ATTACKER_ID,
      ),
    ).toEqual([]);
    expect(result.snapshot.errors).toEqual([]);
  });
});
