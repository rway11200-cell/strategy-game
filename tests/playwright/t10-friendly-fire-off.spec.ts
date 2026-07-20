import { expect, test } from "@playwright/test";
import { GameTestDriver, getUnit } from "./support/GameTestDriver";

const ATTACKER_ID = "player-attacker";
const ALLY_ID = "closer-player-ally";
const ENEMY_ID = "farther-enemy";

test("friendly fire desactivado ignora al aliado más cercano y ataca al enemigo", async ({
  page,
}) => {
  const game = new GameTestDriver(page);

  const setup =
    await test.step("Dado un aliado más cercano que un enemigo, ambos en rango", async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("friendly-fire-selection", {
        friendlyFire: false,
      });
      const attackerCell = game.point(scenario, "attacker");
      const allyCell = game.point(scenario, "closerAlly");
      const enemyCell = game.point(scenario, "fartherEnemy");

      await game.spawnUnit({
        scenarioId: scenario.id,
        id: ATTACKER_ID,
        archetype: "test-ranged-unit",
        team: "player",
        cell: attackerCell,
        stats: { damage: 20, rangeCells: 3, fireCooldownFrames: 1 },
      });
      const ally = await game.spawnUnit({
        scenarioId: scenario.id,
        id: ALLY_ID,
        archetype: "test-target",
        team: "player",
        cell: allyCell,
        stats: { hp: 100 },
      });
      const enemy = await game.spawnUnit({
        scenarioId: scenario.id,
        id: ENEMY_ID,
        archetype: "goblin",
        team: "enemy",
        cell: enemyCell,
        stats: { hp: 100 },
      });
      return { scenario, ally, enemy };
    });

  await test.step("Cuando la atacante busca automáticamente un objetivo", async () => {
    await game.issueOrder(ATTACKER_ID, { type: "hold-position" });
  });

  await test.step("Entonces selecciona y daña solamente al enemigo", async () => {
    const acquired = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      condition: { type: "event", eventType: "target.acquired", unitId: ATTACKER_ID },
    });
    expect(acquired.matchedEvent.targetId).toBe(ENEMY_ID);

    const impact = await game.advanceUntil({
      scenarioId: setup.scenario.id,
      afterSequence: acquired.matchedEvent.sequence,
      condition: { type: "event", eventType: "damage.applied", targetId: ENEMY_ID },
    });
    expect(getUnit(impact.snapshot, ALLY_ID).hp).toBe(setup.ally.hp);
    expect(getUnit(impact.snapshot, ENEMY_ID).hp).toBe(setup.enemy.hp - 20);
    expect(
      impact.snapshot.events.filter(
        (event) =>
          event.sourceId === ATTACKER_ID &&
          event.targetId === ALLY_ID &&
          ["projectile.launched", "damage.applied"].includes(event.type),
      ),
    ).toEqual([]);
    expect(impact.snapshot.rules.friendlyFire).toBe(false);
    expect(impact.snapshot.errors).toEqual([]);
  });
});
