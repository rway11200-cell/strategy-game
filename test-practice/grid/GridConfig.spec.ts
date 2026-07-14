import { describe, expect, it } from "vitest";
import { CELL_TYPES, createGridConfig, gridToWorld, worldToGrid } from "../../src/core/grid/GridConfig";

describe("GridConfig", () => {
  describe("createGridConfig", () => {
    it("returns defaults when no partial is given", () => {
      const config = createGridConfig();
      expect(config.cellSize).toBe(64);
      expect(config.gridWidth).toBe(12);
      expect(config.gridHeight).toBe(9);
      expect(config.offsetX).toBe(0);
      expect(config.offsetY).toBe(0);
    });

    it("merges partial values with defaults", () => {
      const config = createGridConfig({ cellSize: 32, gridWidth: 10 });
      expect(config.cellSize).toBe(32);
      expect(config.gridWidth).toBe(10);
      expect(config.gridHeight).toBe(9);
      expect(config.offsetX).toBe(0);
      expect(config.offsetY).toBe(0);
    });

    it("accepts all fields", () => {
      const config = createGridConfig({
        cellSize: 128,
        gridWidth: 8,
        gridHeight: 6,
        offsetX: 100,
        offsetY: 200,
      });
      expect(config).toEqual({ cellSize: 128, gridWidth: 8, gridHeight: 6, offsetX: 100, offsetY: 200 });
    });
  });

  describe("coordinate conversion roundtrip", () => {
    const config = createGridConfig({ cellSize: 64, offsetX: 50, offsetY: 30 });

    it("gridToWorld returns the pixel center of a cell", () => {
      const world = gridToWorld(2, 3, config);
      expect(world.x).toBe(50 + 2 * 64 + 32);
      expect(world.y).toBe(30 + 3 * 64 + 32);
    });

    it("worldToGrid returns the correct cell for a world position", () => {
      const grid = worldToGrid(50 + 2 * 64 + 32, 30 + 3 * 64 + 32, config);
      expect(grid.x).toBe(2);
      expect(grid.y).toBe(3);
    });

    it("roundtrips for several positions", () => {
      const cases = [
        { gx: 0, gy: 0 },
        { gx: 5, gy: 3 },
        { gx: 19, gy: 14 },
        { gx: 10, gy: 7 },
      ];
      for (const { gx, gy } of cases) {
        const world = gridToWorld(gx, gy, config);
        const back = worldToGrid(world.x, world.y, config);
        expect(back.x).toBe(gx);
        expect(back.y).toBe(gy);
      }
    });
  });

  describe("CELL_TYPES exhaustion", () => {
    it("includes exactly the six expected cell types", () => {
      expect(CELL_TYPES).toContain("walkable");
      expect(CELL_TYPES).toContain("blocked");
      expect(CELL_TYPES).toContain("spawn");
      expect(CELL_TYPES).toContain("base");
      expect(CELL_TYPES).toContain("tower");
      expect(CELL_TYPES).toContain("path");
      expect(CELL_TYPES.length).toBe(6);
    });
  });
});
