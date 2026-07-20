import { expect, test } from "./support/GameTestFixture";

test.describe("contrato público de GameTestApi", () => {
  test("expone un snapshot de arranque coherente y atómico", async ({ game }) => {
    await test.step("Dado que la aplicación terminó de cargar", async () => {
      await game.open();
      await game.waitUntilReady();
    });

    await test.step("Entonces renderer, versión y grid están listos en el mismo snapshot", async () => {
      const boot = await game.getBootSnapshot();
      expect(boot).toMatchObject({
        lifecycle: "ready",
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        renderer: {
          surfaceCount: 1,
          width: expect.any(Number),
          height: expect.any(Number),
        },
        errors: [],
      });
      expect(boot.renderer.width).toBeGreaterThan(0);
      expect(boot.renderer.height).toBeGreaterThan(0);
    });
  });

  test("la cuadrícula inicial es rectangular y sus coordenadas son consistentes", async ({
    game,
  }) => {
    await game.open();
    await game.waitUntilReady();

    const grid = (await game.getBootSnapshot()).grid;
    expect(grid.columns).toBeGreaterThan(0);
    expect(grid.rows).toBeGreaterThan(0);
    expect(grid.tileSize).toBeGreaterThan(0);
    expect(grid.cells).toHaveLength(grid.rows);

    for (const [row, cells] of grid.cells.entries()) {
      expect(cells, `row ${row} must contain every column`).toHaveLength(grid.columns);
      for (const [col, cell] of cells.entries()) {
        expect(cell).toMatchObject({ col, row, occupied: expect.any(Boolean) });
        expect(cell.occupied || cell.occupantId === undefined).toBe(true);
      }
    }
  });

  test("colocar una torre actualiza economía y ocupación como una sola transacción", async ({
    game,
  }) => {
    await game.open();
    await game.waitUntilReady();
    const scenario = await game.beginScenario("tower-placement");
    const buildCell = game.point(scenario, "buildCell");
    const before = await game.snapshot(scenario.id);

    const placement = await game.placeTower({
      scenarioId: scenario.id,
      id: "placed-tower",
      archetype: "basic-tower",
      cell: buildCell,
    });
    const after = await game.snapshot(scenario.id);

    expect(placement.tower).toMatchObject({
      id: "placed-tower",
      active: true,
      cell: buildCell,
      occupiedCells: [buildCell],
    });
    expect(
      after.cells.find(
        (cell) => cell.cell.col === buildCell.col && cell.cell.row === buildCell.row,
      ),
    ).toMatchObject({
      occupied: true,
      occupantId: "placed-tower",
    });
    expect(after.units).toHaveLength(before.units.length + 1);
    expect(placement.cost).toBeGreaterThan(0);
    expect(after.economy.coins).toBe(before.economy.coins - placement.cost);
    expect(after.errors).toEqual([]);
  });
});
