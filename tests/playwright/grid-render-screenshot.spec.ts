import { test, expect } from "@playwright/test";

test.describe("Grid visual rendering", () => {
  test("canvas is rendered with correct dimensions", async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <div id="pixi-container" style="width:640px;height:480px;"></div>
        <script type="importmap">
        {
          "imports": {
            "pixi.js": "../../node_modules/pixi.js/dist/pixi.min.mjs"
          }
        }
        </script>
        <script type="module">
          import { Application, Container } from "pixi.js";
          import { createGridConfig } from "../../src/core/grid/GridConfig.ts";
          import { PixiGridRenderer } from "../../src/grid/render/PixiGridRenderer.ts";

          const app = new Application();
          await app.init({
            width: 640,
            height: 480,
            background: "#222222",
            antialias: true,
          });
          document.getElementById("pixi-container").appendChild(app.canvas);

          const config = createGridConfig({ cellSize: 64, gridWidth: 10, gridHeight: 7 });
          const container = new Container();
          app.stage.addChild(container);

          const renderer = new PixiGridRenderer(container, config);

          const cells = [];
          for (let row = 0; row < 7; row++) {
            const rowData = [];
            for (let col = 0; col < 10; col++) {
              const type = (row === 3 && col === 5) ? "blocked" : "walkable";
              rowData.push({ col, row, type, occupied: false, walkCost: 1 });
            }
            cells.push(rowData);
          }
          renderer.render(cells);
          renderer.highlightPath([{ col: 0, row: 3 }, { col: 4, row: 3 }, { col: 5, row: 2 }, { col: 6, row: 3 }, { col: 9, row: 3 }]);

          window.__gridRendered = true;
        </script>
      </body>
      </html>
    `);

    await page.waitForFunction(() => (window as Record<string, unknown>).__gridRendered, { timeout: 10000 });

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    const boundingBox = await canvas.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot("grid-render.png", {
      maxDiffPixels: 100,
      animations: "disabled",
    });
  });
});
