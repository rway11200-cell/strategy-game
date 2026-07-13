import { describe, expect, it } from "vitest";
import { type Point } from "../../src/core/grid/GridConfig";
import {
  type Footprint,
  pathToFootprint,
  footprintToPoints,
  isContiguous,
} from "../../src/grid/Footprint";

describe("Footprint", () => {
  describe("pathToFootprint", () => {
    it("converts an array of Points to PathCells", () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ];
      const footprint = pathToFootprint(points);
      expect(footprint.cells).toEqual([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ]);
    });

    it("handles an empty array", () => {
      const footprint = pathToFootprint([]);
      expect(footprint.cells).toEqual([]);
    });

    it("handles a single point", () => {
      const footprint = pathToFootprint([{ x: 5, y: 7 }]);
      expect(footprint.cells).toEqual([{ col: 5, row: 7 }]);
    });
  });

  describe("footprintToPoints", () => {
    it("converts PathCells back to Points", () => {
      const footprint: Footprint = {
        cells: [
          { col: 3, row: 1 },
          { col: 3, row: 2 },
          { col: 3, row: 3 },
        ],
      };
      const points = footprintToPoints(footprint);
      expect(points).toEqual([
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
      ]);
    });
  });

  describe("roundtrip", () => {
    it("pathToFootprint -> footprintToPoints returns the original points", () => {
      const original: Point[] = [
        { x: 2, y: 3 },
        { x: 2, y: 4 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
      ];
      const footprint = pathToFootprint(original);
      const result = footprintToPoints(footprint);
      expect(result).toEqual(original);
    });
  });

  describe("isContiguous", () => {
    it("returns true for horizontally adjacent cells", () => {
      const footprint: Footprint = {
        cells: [
          { col: 0, row: 0 },
          { col: 1, row: 0 },
          { col: 2, row: 0 },
        ],
      };
      expect(isContiguous(footprint)).toBe(true);
    });

    it("returns true for vertically adjacent cells", () => {
      const footprint: Footprint = {
        cells: [
          { col: 2, row: 0 },
          { col: 2, row: 1 },
          { col: 2, row: 2 },
        ],
      };
      expect(isContiguous(footprint)).toBe(true);
    });

    it("returns true for an L-shaped path", () => {
      const footprint: Footprint = {
        cells: [
          { col: 0, row: 0 },
          { col: 0, row: 1 },
          { col: 1, row: 1 },
          { col: 2, row: 1 },
        ],
      };
      expect(isContiguous(footprint)).toBe(true);
    });

    it("returns false when cells are not adjacent", () => {
      const footprint: Footprint = {
        cells: [
          { col: 0, row: 0 },
          { col: 2, row: 0 },
        ],
      };
      expect(isContiguous(footprint)).toBe(false);
    });

    it("returns true for a single cell", () => {
      const footprint: Footprint = {
        cells: [{ col: 3, row: 3 }],
      };
      expect(isContiguous(footprint)).toBe(true);
    });

    it("returns true for an empty footprint", () => {
      const footprint: Footprint = { cells: [] };
      expect(isContiguous(footprint)).toBe(true);
    });
  });
});
