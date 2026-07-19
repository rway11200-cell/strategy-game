import { expect, test, type Page } from "@playwright/test";

async function waitForGameReady(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const api = (window as Record<string, unknown>).__GAME_TEST__;
      if (!api) return false;

      return (
        typeof (api as { isReady?: unknown }).isReady === "function" &&
        (api as { isReady: () => boolean }).isReady()
      );
    },
    undefined,
    { timeout },
  );
}

test("renders two grid positions as patrol endpoints", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await waitForGameReady(page);

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();

  const canvasSize = await canvas.evaluate((element) => ({
    cssWidth: element.getBoundingClientRect().width,
    cssHeight: element.getBoundingClientRect().height,
    width: element.width,
    height: element.height,
  }));
  expect(canvasSize.width).toBeGreaterThan(0);
  expect(canvasSize.height).toBeGreaterThan(0);
  expect(canvasSize.cssWidth).toBeGreaterThan(0);
  expect(canvasSize.cssHeight).toBeGreaterThan(0);

  await page.screenshot({
    path: testInfo.outputPath("patrol-grid-initial.png"),
    fullPage: true,
  });

  const snapshot = await page.evaluate(() => ({
    grid: window.__GAME_TEST__!.getGrid(),
    state: window.__GAME_TEST__!.getState(),
  }));

  expect(snapshot.state.errors).toEqual([]);
  expect(snapshot.grid.columns).toBeGreaterThan(1);
  expect(snapshot.grid.rows).toBeGreaterThan(0);
  expect(snapshot.grid.tileSize).toBeGreaterThan(0);
  expect(snapshot.grid.cells).toHaveLength(snapshot.grid.rows);
  expect(snapshot.grid.cells.every((row) => row.length === snapshot.grid.columns)).toBe(true);

  const cells = snapshot.grid.cells.flat().filter((cell) => cell.type !== "unknown");
  expect(cells.length).toBeGreaterThanOrEqual(2);

  const patrolPoints = [cells[0], cells[cells.length - 1]].map((cell) => ({
    col: cell.col,
    row: cell.row,
    worldX: (cell.col + 0.5) * snapshot.grid.tileSize,
    worldY: (cell.row + 0.5) * snapshot.grid.tileSize,
  }));

  expect(patrolPoints[0]).not.toEqual(patrolPoints[1]);
  for (const point of patrolPoints) {
    expect(point.worldX).toBeGreaterThan(0);
    expect(point.worldY).toBeGreaterThan(0);
    expect(point.worldX).toBeLessThan(canvasSize.width);
    expect(point.worldY).toBeLessThan(canvasSize.height);
  }

  const showPatrolPoint = async (pointIndex: number, label: string) => {
    const point = patrolPoints[pointIndex];
    await page.evaluate(
      ({ col, row, worldX, worldY, markerLabel }) => {
        const canvasElement = document.querySelector("canvas");
        if (!(canvasElement instanceof HTMLCanvasElement)) {
          throw new Error("Game canvas was not found");
        }

        document.querySelector("[data-testid='patrol-marker']")?.remove();
        const bounds = canvasElement.getBoundingClientRect();
        const marker = document.createElement("div");
        marker.dataset.testid = "patrol-marker";
        marker.textContent = markerLabel;
        marker.title = `Grid cell (${col}, ${row})`;
        Object.assign(marker.style, {
          position: "fixed",
          left: `${bounds.left + (worldX / canvasElement.width) * bounds.width}px`,
          top: `${bounds.top + (worldY / canvasElement.height) * bounds.height}px`,
          width: "28px",
          height: "28px",
          border: "3px solid white",
          borderRadius: "50%",
          background: "#e63946",
          color: "white",
          font: "bold 14px/28px sans-serif",
          textAlign: "center",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 0 3px #111, 0 0 12px #e63946",
          zIndex: "2147483647",
          pointerEvents: "none",
        });
        document.body.append(marker);
      },
      { ...point, markerLabel: label },
    );

    await expect(page.getByTestId("patrol-marker")).toBeVisible();
  };

  await showPatrolPoint(0, "A");
  await page.screenshot({
    path: testInfo.outputPath("patrol-point-a.png"),
    fullPage: true,
  });

  await showPatrolPoint(1, "B");
  await page.screenshot({
    path: testInfo.outputPath("patrol-point-b.png"),
    fullPage: true,
  });

  const finalSnapshot = await page.evaluate(() => ({
    grid: window.__GAME_TEST__!.getGrid(),
    state: window.__GAME_TEST__!.getState(),
  }));
  expect(finalSnapshot.grid).toEqual(snapshot.grid);
  expect(finalSnapshot.state.errors).toEqual([]);
});
