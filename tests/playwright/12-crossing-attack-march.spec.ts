import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const PLAYER_ID = "marching-player";
const ENEMY_ID = "marching-enemy";

test("dos guerreros con ataque-marcha se enfrentan al cruzarse y continúan hacia su destino", async ({
  game,
}) => {
  const setup = await test.step(
    "Dado dos guerreros en extremos opuestos de un corredor",
    async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("warrior-auto-march");
      const playerStart = game.point(scenario, "playerStart");
      const playerDest = game.point(scenario, "playerDestination");
      const enemyStart = game.point(scenario, "enemyStart");
      const enemyDest = game.point(scenario, "enemyDestination");

      const player = await game.spawnUnit({
        scenarioId: scenario.id,
        id: PLAYER_ID,
        archetype: "warrior",
        team: "player",
        cell: playerStart,
        stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 60 },
      });
      const enemy = await game.spawnUnit({
        scenarioId: scenario.id,
        id: ENEMY_ID,
        archetype: "warrior",
        team: "enemy",
        cell: enemyStart,
        stats: { hp: 200, damage: 4, rangeCells: 1, fireCooldownFrames: 60, movementFramesPerCell: 60 },
      });

      expect(player).toMatchObject({ id: PLAYER_ID, cell: playerStart, active: true });
      expect(enemy).toMatchObject({ id: ENEMY_ID, cell: enemyStart, active: true });
      return { scenario, playerStart, playerDest, enemyStart, enemyDest };
    },
  );

  await test.step("Cuando ambos reciben orden de ataque-marcha hacia el extremo opuesto", async () => {
    const playerOrder = await game.issueOrder(PLAYER_ID, {
      type: "attack-move",
      destination: setup.playerDest,
    });
    expect(playerOrder).toMatchObject({
      unitId: PLAYER_ID,
      type: "attack-move",
      status: "running",
      destination: setup.playerDest,
    });

    const enemyOrder = await game.issueOrder(ENEMY_ID, {
      type: "attack-move",
      destination: setup.enemyDest,
    });
    expect(enemyOrder).toMatchObject({
      unitId: ENEMY_ID,
      type: "attack-move",
      status: "running",
      destination: setup.enemyDest,
    });
  });

  await test.step("Entonces se desplazan y puede ocurrir daño al encontrarse", async () => {
    const snapshot = await game.advanceFrames(setup.scenario.id, 400);
    const player = getUnit(snapshot, PLAYER_ID);
    const enemy = getUnit(snapshot, ENEMY_ID);

    expect(player.cell?.col).toBeGreaterThanOrEqual(2);
    expect(enemy.cell?.col).toBeLessThanOrEqual(5);
    expect(snapshot.cells.filter((c) => c.occupied)).toHaveLength(2);

    const playerOccupied = snapshot.cells.filter((c) => c.occupantId === PLAYER_ID);
    const enemyOccupied = snapshot.cells.filter((c) => c.occupantId === ENEMY_ID);
    expect(playerOccupied).toHaveLength(1);
    expect(enemyOccupied).toHaveLength(1);
    expect(playerOccupied[0].cell).not.toEqual(enemyOccupied[0].cell);

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
