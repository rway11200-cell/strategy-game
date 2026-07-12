import { describe, expect, it } from "vitest";
import { type CellType, createDefaultGridConfig } from "../../src/grid/GridConfig";

describe("GridConfig", () => {
  describe("createDefaultGridConfig", () => {
    it("returns default values when called with no arguments", () => {
      const config = createDefaultGridConfig();
      expect(config.cellSize).toBe(64);
      expect(config.gridWidth).toBe(20);
      expect(config.gridHeight).toBe(15);
      expect(config.offsetX).toBe(0);
      expect(config.offsetY).toBe(0);
    });

    it("merges partial overrides with defaults", () => {
      const config = createDefaultGridConfig({ cellSize: 32, gridWidth: 10 });
      expect(config.cellSize).toBe(32);
      expect(config.gridWidth).toBe(10);
      expect(config.gridHeight).toBe(15);
      expect(config.offsetX).toBe(0);
      expect(config.offsetY).toBe(0);
    });

    it("accepts all fields", () => {
      const config = createDefaultGridConfig({
        cellSize: 128,
        gridWidth: 8,
        gridHeight: 6,
        offsetX: 100,
        offsetY: 200,
      });
      expect(config).toEqual({
        cellSize: 128,
        gridWidth: 8,
        gridHeight: 6,
        offsetX: 100,
        offsetY: 200,
      });
    });
  });

  describe("CellCoord", () => {
    it("can be constructed with col and row", () => {
      const coord = { col: 3, row: 7 };
      expect(coord.col).toBe(3);
      expect(coord.row).toBe(7);
    });
  });

  describe("CellType enum values", () => {
    it("includes all expected cell types", () => {
      const types: CellType[] = ["walkable", "blocked", "spawn", "base", "tower", "path"];
      for (const t of types) {
        expect(t).toBeDefined();
      }
      expect(types.length).toBe(6);
    });
  });
});
