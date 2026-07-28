import { expect, test } from "./support/GameTestFixture";

test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

test("al seleccionar una unidad el playground muestra su ficha de estadísticas", async ({ game, page }) => {
  const setup = await test.step("Dada una arquera jugadora con estadísticas conocidas", async () => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("warrior-march");
    const origin = game.point(scenario, "origin");
    await game.spawnUnit({
      scenarioId: scenario.id,
      id: "inspected-archer",
      archetype: "archer",
      team: "player",
      cell: origin,
      stats: { hp: 175, damage: 24, rangeCells: 2, fireCooldownFrames: 30 },
    });
    return { scenario, origin };
  });

  await test.step("Cuando se selecciona la arquera en el canvas", async () => {
    const scene = page.locator("#pixi-container");
    const box = await scene.boundingBox();
    if (!box) throw new Error("Gameplay canvas is not visible");

    const gridWidth = setup.scenario.grid.columns * setup.scenario.grid.tileSize;
    const gridHeight = setup.scenario.grid.rows * setup.scenario.grid.tileSize;
    await scene.click({
      position: {
        x: (box.width - gridWidth) / 2 + (setup.origin.col + 0.5) * setup.scenario.grid.tileSize,
        y: (box.height - gridHeight) / 2 + (setup.origin.row + 0.5) * setup.scenario.grid.tileSize,
      },
    });
  });

  await test.step("Entonces se ve la ficha de jugador con sus estadísticas", async () => {
    await expect(page.locator("#pixi-container")).toHaveScreenshot(
      "selected-player-unit-stats.png",
      { animations: "disabled", caret: "hide", scale: "css", maxDiffPixels: 20 },
    );
  });
});
