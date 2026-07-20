import { expect, test } from "@playwright/test";
import type { GridVisualFixture } from "../../src/app/testing/GridVisualTestApi";

const fixture: GridVisualFixture = {
  viewport: { width: 512, height: 384, deviceScaleFactor: 1 },
  config: { columns: 6, rows: 4, tileSize: 64, offsetX: 64, offsetY: 64 },
  cellTypes: [
    ["walkable", "blocked", "spawn", "base", "tower", "path"],
    ["walkable", "walkable", "walkable", "walkable", "walkable", "walkable"],
    ["walkable", "walkable", "walkable", "walkable", "walkable", "walkable"],
    ["blocked", "walkable", "walkable", "walkable", "walkable", "blocked"],
  ],
  path: [
    { col: 0, row: 2 },
    { col: 1, row: 2 },
    { col: 2, row: 1 },
    { col: 3, row: 1 },
    { col: 4, row: 2 },
    { col: 5, row: 2 },
  ],
  highlightedCell: { col: 3, row: 2 },
};

test("el renderer dibuja todos los tipos de celda y overlays en capas", async ({ page }) => {
  await test.step("Dado un fixture visual fijo", async () => {
    await page.setViewportSize({ width: fixture.viewport.width, height: fixture.viewport.height });
    await page.goto("/__test__/grid-renderer/");
    await expect(page.getByTestId("grid-test-root")).toHaveAttribute("data-state", "ready");
    await page.evaluate((visualFixture) => {
      if (!window.__GRID_VISUAL_TEST__) throw new Error("GridVisualTestApi is not available");
      window.__GRID_VISUAL_TEST__.renderFixture(visualFixture);
    }, fixture);
  });

  await test.step("Cuando el renderer confirma el siguiente frame", async () => {
    const snapshot = await page.evaluate(() => window.__GRID_VISUAL_TEST__!.waitForRender());
    expect(snapshot).toEqual({
      frame: expect.any(Number),
      canvas: { cssWidth: 512, cssHeight: 384, backingWidth: 512, backingHeight: 384 },
      layers: ["cells", "path", "highlight"],
      cellCount: 24,
      path: fixture.path,
      highlightedCell: fixture.highlightedCell,
    });
    expect(snapshot.frame).toBeGreaterThan(0);
  });

  await test.step("Entonces la salida visual coincide con el baseline", async () => {
    await expect(page.getByTestId("grid-canvas")).toHaveScreenshot(
      "grid-renderer.all-cell-types-and-overlays.png",
      { animations: "disabled", caret: "hide", scale: "css", maxDiffPixels: 20 },
    );
  });
});
