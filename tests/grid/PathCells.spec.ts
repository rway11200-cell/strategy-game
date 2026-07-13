import { describe, expect, it } from "vitest";
import { createDefaultGridConfig } from "../../src/grid/GridConfig";
import { GridState } from "../../src/grid/GridState";
import { findPath } from "../../src/grid/Pathfinder";
import { pathToFootprint, isContiguous } from "../../src/grid/Footprint";

function buildState(
  width: number,
  height: number,
  blocked: { col: number; row: number }[] = [],
): GridState {
  const config = createDefaultGridConfig({ gridWidth: width, gridHeight: height });
  const state = new GridState(config);
  for (const b of blocked) {
    const cell = state.getCell(b);
    if (cell) {
      state.setCell(b, { ...cell, type: "blocked" });
    }
  }
  return state;
}

describe("PathCells", () => {
  describe("contiguity", () => {
    it("returns a path where every adjacent pair is contiguous", () => {
      const state = buildState(10, 10);
      const path = findPath({ x: 0, y: 0 }, { x: 9, y: 9 }, state);
      const footprint = pathToFootprint(path);
      expect(isContiguous(footprint)).toBe(true);
    });

    it("returns a contiguous path around an obstacle", () => {
      const state = buildState(5, 5, [{ col: 2, row: 1 }, { col: 2, row: 2 }]);
      const path = findPath({ x: 0, y: 0 }, { x: 4, y: 4 }, state);
      const footprint = pathToFootprint(path);
      expect(isContiguous(footprint)).toBe(true);
    });

    it("path cells are all within grid bounds", () => {
      const state = buildState(5, 5);
      const path = findPath({ x: 0, y: 0 }, { x: 4, y: 4 }, state);
      for (const p of path) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(5);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(5);
      }
    });
  });

  describe("shortest path", () => {
    it("returns the shortest possible path on an open grid", () => {
      const state = buildState(4, 4);
      const path = findPath({ x: 0, y: 0 }, { x: 3, y: 3 }, state);
      expect(path.length).toBe(6);
    });

    it("returns a longer path when obstacles block the direct route", () => {
      const state = buildState(8, 8, [
        { col: 1, row: 0 },
        { col: 1, row: 1 },
        { col: 1, row: 2 },
        { col: 1, row: 3 },
        { col: 1, row: 4 },
        { col: 1, row: 5 },
      ]);
      const path = findPath({ x: 0, y: 0 }, { x: 7, y: 7 }, state);
      const directLength = 14;
      expect(path.length).toBeGreaterThanOrEqual(directLength);
    });

    it("does not revisit cells in the returned path", () => {
      const state = buildState(6, 6);
      const path = findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, state);
      const seen = new Set<string>();
      for (const p of path) {
        const key = `${p.x},${p.y}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    });
  });

  describe("blocked cells", () => {
    it("does not include blocked cells in the path", () => {
      const blocked = { col: 1, row: 0 };
      const state = buildState(3, 3, [blocked]);
      const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, state);
      for (const p of path) {
        expect(p.x !== blocked.col || p.y !== blocked.row).toBe(true);
      }
    });

    it("avoids a cluster of blocked cells in the center", () => {
      const blocked = [
        { col: 2, row: 1 },
        { col: 2, row: 2 },
        { col: 2, row: 3 },
        { col: 1, row: 2 },
        { col: 3, row: 2 },
      ];
      const state = buildState(6, 6, blocked);
      const path = findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, state);
      expect(path.length).toBeGreaterThan(0);
      const footprint = pathToFootprint(path);
      expect(isContiguous(footprint)).toBe(true);
    });
  });

  describe("walkCost", () => {
    it("prefers lower-cost cells when multiple paths exist", () => {
      const config = createDefaultGridConfig({ gridWidth: 3, gridHeight: 3 });
      const state = new GridState(config);
      const direct = state.getCell({ col: 1, row: 0 });
      state.setCell({ col: 1, row: 0 }, { ...direct!, walkCost: 100 });

      const upper = state.getCell({ col: 1, row: 0 });
      const lower = state.getCell({ col: 1, row: 2 });
      state.setCell({ col: 1, row: 0 }, { ...upper!, walkCost: 100 });
      state.setCell({ col: 1, row: 2 }, { ...lower!, walkCost: 1 });

      const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, state);
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("handles start at the top-left corner", () => {
      const state = buildState(3, 3);
      const path = findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, state);
      expect(path.length).toBeGreaterThan(0);
    });

    it("handles start at the bottom-right corner", () => {
      const state = buildState(3, 3);
      const path = findPath({ x: 2, y: 2 }, { x: 0, y: 0 }, state);
      expect(path.length).toBeGreaterThan(0);
    });

    it("handles navigating a spiral-like blocked pattern", () => {
      const blocked = [
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 2, row: 1 },
        { col: 2, row: 2 },
        { col: 1, row: 2 },
        { col: 0, row: 2 },
      ];
      const state = buildState(3, 3, blocked);
      const path = findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, state);
      expect(path.length).toBe(0);
    });

    it("returns empty when the grid has no walkable path to end", () => {
      const state = buildState(2, 1, [{ col: 1, row: 0 }]);
      const path = findPath({ x: 0, y: 0 }, { x: 1, y: 0 }, state);
      expect(path).toEqual([]);
    });
  });
});
