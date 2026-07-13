import { describe, expect, it } from "vitest";
import {
  createGridConfig,
  gridToWorld,
  worldToGrid,
} from "../../src/core/grid/GridConfig";
import { createDefaultGridConfig } from "../../src/grid/GridConfig";

describe("Coordinates", () => {
  describe("gridToWorld", () => {
    it("returns the pixel center of the top-left cell", () => {
      const config = createGridConfig({ cellSize: 64, offsetX: 0, offsetY: 0 });
      const world = gridToWorld(0, 0, config);
      expect(world.x).toBe(32);
      expect(world.y).toBe(32);
    });

    it("returns the pixel center of a cell in the middle of the grid", () => {
      const config = createGridConfig({ cellSize: 64, offsetX: 100, offsetY: 50 });
      const world = gridToWorld(3, 5, config);
      expect(world.x).toBe(100 + 3 * 64 + 32);
      expect(world.y).toBe(50 + 5 * 64 + 32);
    });

    it("works with non-standard cell sizes", () => {
      const config = createGridConfig({ cellSize: 128, offsetX: 0, offsetY: 0 });
      const world = gridToWorld(1, 1, config);
      expect(world.x).toBe(128 + 64);
      expect(world.y).toBe(128 + 64);
    });

    it("works with negative offsets", () => {
      const config = createGridConfig({ cellSize: 64, offsetX: -200, offsetY: -100 });
      const world = gridToWorld(0, 0, config);
      expect(world.x).toBe(-200 + 32);
      expect(world.y).toBe(-100 + 32);
    });
  });

  describe("worldToGrid", () => {
    it("returns col 0, row 0 for a pixel near the origin", () => {
      const config = createGridConfig({ cellSize: 64, offsetX: 0, offsetY: 0 });
      const grid = worldToGrid(10, 10, config);
      expect(grid.x).toBe(0);
      expect(grid.y).toBe(0);
    });

    it("returns the correct cell for a pixel at the center of a cell", () => {
      const config = createGridConfig({ cellSize: 64, offsetX: 0, offsetY: 0 });
      const grid = worldToGrid(32 + 3 * 64, 32 + 5 * 64, config);
      expect(grid.x).toBe(3);
      expect(grid.y).toBe(5);
    });

    it("returns the correct cell for a pixel at the edge of a cell", () => {
      const config = createGridConfig({ cellSize: 64, offsetX: 0, offsetY: 0 });
      const grid = worldToGrid(63, 63, config);
      expect(grid.x).toBe(0);
      expect(grid.y).toBe(0);
    });

    it("handles pixels before the grid offset (negative coordinates)", () => {
      const config = createGridConfig({ cellSize: 64, offsetX: 50, offsetY: 30 });
      const grid = worldToGrid(10, 10, config);
      expect(grid.x).toBe(-1);
      expect(grid.y).toBe(-1);
    });
  });

  describe("roundtrip consistency", () => {
    const config = createGridConfig({ cellSize: 64, offsetX: 50, offsetY: 30 });

    it("gridToWorld -> worldToGrid returns the original column and row", () => {
      const testCases = [
        { col: 0, row: 0 },
        { col: 5, row: 3 },
        { col: 19, row: 14 },
        { col: 10, row: 7 },
        { col: 0, row: 14 },
        { col: 19, row: 0 },
      ];
      for (const { col, row } of testCases) {
        const world = gridToWorld(col, row, config);
        const back = worldToGrid(world.x, world.y, config);
        expect(back.x).toBe(col);
        expect(back.y).toBe(row);
      }
    });

    it("worldToGrid -> gridToWorld is idempotent for cell-center pixels", () => {
      const config2 = createGridConfig({ cellSize: 128, offsetX: 100, offsetY: 200 });
      const testPixels = [
        { x: 100 + 64, y: 200 + 64 },
        { x: 100 + 3 * 128 + 64, y: 200 + 5 * 128 + 64 },
        { x: 100 + 10 * 128 + 64, y: 200 + 8 * 128 + 64 },
      ];
      for (const pixel of testPixels) {
        const grid = worldToGrid(pixel.x, pixel.y, config2);
        const world = gridToWorld(grid.x, grid.y, config2);
        expect(world.x).toBe(pixel.x);
        expect(world.y).toBe(pixel.y);
      }
    });
  });

  describe("createDefaultGridConfig (src/grid)", () => {
    it("has the same defaults as createGridConfig (src/core/grid)", () => {
      const coreConfig = createGridConfig();
      const newConfig = createDefaultGridConfig();
      expect(newConfig.cellSize).toBe(coreConfig.cellSize);
      expect(newConfig.gridWidth).toBe(coreConfig.gridWidth);
      expect(newConfig.gridHeight).toBe(coreConfig.gridHeight);
      expect(newConfig.offsetX).toBe(coreConfig.offsetX);
      expect(newConfig.offsetY).toBe(coreConfig.offsetY);
    });
  });

  describe("boundary conditions", () => {
    const config = createGridConfig({ cellSize: 64, gridWidth: 5, gridHeight: 5 });

    it("worldToGrid returns a valid column for the last pixel inside the grid", () => {
      const grid = worldToGrid(5 * 64 - 1, 5 * 64 - 1, config);
      expect(grid.x).toBe(4);
      expect(grid.y).toBe(4);
    });

    it("worldToGrid returns the last column for the exact right edge pixel", () => {
      const grid = worldToGrid(5 * 64, 0, config);
      expect(grid.x).toBe(5);
    });

    it("gridToWorld returns consistent positions for all cells in a small grid", () => {
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 5; row++) {
          const world = gridToWorld(col, row, config);
          expect(world.x).toBe(col * 64 + 32);
          expect(world.y).toBe(row * 64 + 32);
        }
      }
    });
  });
});
