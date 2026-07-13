import { describe, expect, it } from "vitest";
import { createGridConfig } from "../../src/core/grid/GridConfig";
import { GridIntegration } from "../../src/grid/GridIntegration";

function makeIntegration() {
  const gridConfig = createGridConfig({ gridWidth: 10, gridHeight: 10, cellSize: 64 });
  return new GridIntegration({
    gridConfig,
    spawn: { col: 0, row: 0 },
    base: { col: 9, row: 9 },
  });
}

describe("GridIntegration", () => {
  describe("construction", () => {
    it("creates grid state with correct dimensions", () => {
      const gi = makeIntegration();
      expect(gi.spawn).toEqual({ col: 0, row: 0 });
      expect(gi.base).toEqual({ col: 9, row: 9 });
      expect(gi.gridState).toBeDefined();
    });

    it("marks blocked cells when provided", () => {
      const gridConfig = createGridConfig({ gridWidth: 5, gridHeight: 5, cellSize: 64 });
      const gi = new GridIntegration({
        gridConfig,
        spawn: { col: 0, row: 0 },
        base: { col: 4, row: 4 },
        blockedCells: [{ col: 2, row: 2 }],
      });
      const cell = gi.gridState.getCell({ col: 2, row: 2 });
      expect(cell!.type).toBe("blocked");
    });
  });

  describe("calculatePath", () => {
    it("returns a path from spawn to base", () => {
      const gi = makeIntegration();
      const path = gi.calculatePath();
      expect(path.length).toBeGreaterThan(0);

      const last = path[path.length - 1];

      expect(last.x).toBeCloseTo(9 * 64 + 32, 0);
      expect(last.y).toBeCloseTo(9 * 64 + 32, 0);
    });

    it("returns world-space pixel coordinates", () => {
      const gi = makeIntegration();
      const path = gi.calculatePath();
      for (const point of path) {
        expect(typeof point.x).toBe("number");
        expect(typeof point.y).toBe("number");
      }
    });

    it("returns empty path when spawn is blocked", () => {
      const gridConfig = createGridConfig({ gridWidth: 5, gridHeight: 5, cellSize: 64 });
      const gi = new GridIntegration({
        gridConfig,
        spawn: { col: 0, row: 0 },
        base: { col: 4, row: 4 },
        blockedCells: [{ col: 0, row: 0 }],
      });
      const path = gi.calculatePath();
      expect(path).toEqual([]);
    });
  });

  describe("cell operations", () => {
    it("isWalkable delegates to grid state", () => {
      const gi = makeIntegration();
      expect(gi.isWalkable(1, 1)).toBe(true);
      expect(gi.isWalkable(-1, -1)).toBe(false);
    });

    it("occupyCell and liberateCell work", () => {
      const gi = makeIntegration();
      gi.occupyCell(3, 3, "tower-1");
      expect(gi.isWalkable(3, 3)).toBe(false);

      gi.liberateCell(3, 3);
      expect(gi.isWalkable(3, 3)).toBe(true);
    });

    it("getCell and setCell work", () => {
      const gi = makeIntegration();
      const cell = gi.getCell(5, 5);
      expect(cell).toBeDefined();
      expect(cell!.type).toBe("walkable");

      gi.setCell(5, 5, { ...cell!, type: "tower", occupied: true, walkCost: 99 });
      const updated = gi.getCell(5, 5);
      expect(updated!.type).toBe("tower");
      expect(updated!.occupied).toBe(true);
    });
  });
});
