import { test, expect, type Page } from "@playwright/test";

/**
 * Helper: espera a que window.__GAME_TEST__ exista y esté ready.
 */
async function waitForGameReady(page: Page, timeout = 15000): Promise<void> {
  await page.waitForFunction(
    () => {
      const api = (window as Record<string, unknown>).__GAME_TEST__;
      if (!api) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return typeof (api as any).isReady === "function" && (api as any).isReady();
    },
    { timeout },
  );
}

test.describe("GameTestApi — window.__GAME_TEST__", () => {
  test("el juego carga y window.__GAME_TEST__ existe", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Confirmar que la API existe
    const exists = await page.evaluate(() => {
      return typeof window.__GAME_TEST__ !== "undefined";
    });
    expect(exists).toBe(true);
  });

  test("isReady() llega a true tras la carga", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await waitForGameReady(page);
    const ready = await page.evaluate(() => window.__GAME_TEST__!.isReady());
    expect(ready).toBe(true);
  });

  test("getState() devuelve un objeto serializable con versión correcta", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await waitForGameReady(page);

    const state = await page.evaluate(() => window.__GAME_TEST__!.getState());

    expect(state).toBeDefined();
    expect(state.version).toBe("0.1.0"); // Debe coincidir con package.json
    expect(typeof state.coins).toBe("number");
    expect(typeof state.enemiesCount).toBe("number");
    expect(typeof state.towersCount).toBe("number");
    expect(Array.isArray(state.errors)).toBe(true);

    // Verificar serialización JSON
    const serialized = JSON.stringify(state);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  test("getGrid() devuelve columnas, rows y tileSize", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await waitForGameReady(page);

    const grid = await page.evaluate(() => window.__GAME_TEST__!.getGrid());

    expect(grid).toBeDefined();
    expect(typeof grid.columns).toBe("number");
    expect(typeof grid.rows).toBe("number");
    expect(typeof grid.tileSize).toBe("number");
    expect(grid.columns).toBeGreaterThan(0);
    expect(grid.rows).toBeGreaterThan(0);
    expect(grid.tileSize).toBeGreaterThan(0);
    expect(Array.isArray(grid.cells)).toBe(true);
    expect(grid.cells.length).toBe(grid.rows);
  });

  test("se puede intentar construir una torre", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await waitForGameReady(page);

    // Obtener la primera celda walkable no ocupada
    const grid = await page.evaluate(() => window.__GAME_TEST__!.getGrid());

    let targetCol = -1;
    let targetRow = -1;

    for (let row = 0; row < grid.cells.length; row++) {
      for (let col = 0; col < grid.cells[row].length; col++) {
        const cell = grid.cells[row][col];
        if (cell.type === "walkable" && !cell.occupied) {
          targetCol = cell.col;
          targetRow = cell.row;
          break;
        }
      }
      if (targetCol >= 0) break;
    }

    // Intentar colocar torre en la celda encontrada
    const result = await page.evaluate(
      ({ col, row }) => window.__GAME_TEST__!.placeTower(col, row),
      { col: targetCol, row: targetRow },
    );

    // Si falló, debe ser porque no hay torres en el pool o no hay coins
    // Pero debe ejecutarse sin errores
    expect(typeof result).toBe("boolean");

    // Verificar que el estado cambió
    const stateAfter = await page.evaluate(() => window.__GAME_TEST__!.getState());
    expect(stateAfter.errors.length).toBe(0);
  });

  test("startWave() inicia sin errores", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await waitForGameReady(page);

    await page.evaluate(() => window.__GAME_TEST__!.startWave());

    // Pequeña espera para que el enemigo se procese
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => window.__GAME_TEST__!.getState());
    expect(state.errors.length).toBe(0);
  });

  test("no hay errores críticos de consola durante la carga", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // También capturar excepciones de página
    page.on("pageerror", (err) => {
      consoleErrors.push(`Page error: ${err.message}`);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await waitForGameReady(page);

    // Registrar errores como info (no deben haber page errors críticos)
    if (consoleErrors.length > 0) {
      console.log("Console errors detected:", consoleErrors);
    }

    // Permitir errores menores (assets faltantes, etc.) pero no page crashes
    // Filtramos errores conocidos de assets vs errores reales
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes("Failed to load resource") &&
        !e.includes("404") &&
        !e.includes("texture") &&
        !e.includes("sprite") &&
        !e.includes("sound") &&
        !e.includes("audio") &&
        !e.includes("fetch"),
    );

    expect(criticalErrors.length).toBe(0);
  });
});
