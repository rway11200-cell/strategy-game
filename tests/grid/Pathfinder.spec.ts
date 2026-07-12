import { describe, expect, it } from "vitest";
import { createDefaultGridConfig } from "../../src/grid/GridConfig";
import { GridState } from "../../src/grid/GridState";
import { findPath } from "../../src/grid/Pathfinder";

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

describe("findPath", () => {
  it("finds a straight horizontal path", () => {
    const state = buildState(5, 1);
    const path = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, state);
    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it("finds a straight vertical path", () => {
    const state = buildState(1, 5);
    const path = findPath({ x: 0, y: 0 }, { x: 0, y: 4 }, state);
    expect(path).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
      { x: 0, y: 4 },
    ]);
  });

  it("navigates around an obstacle", () => {
    const state = buildState(3, 3, [{ col: 1, row: 0 }]);
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, state);
    expect(path).not.toHaveLength(0);
    const last = path[path.length - 1];
    expect(last).toEqual({ x: 2, y: 0 });
  });

  it("returns empty array when start is blocked", () => {
    const state = buildState(3, 3, [{ col: 0, row: 0 }]);
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, state);
    expect(path).toEqual([]);
  });

  it("returns empty array when end is blocked", () => {
    const state = buildState(3, 3, [{ col: 2, row: 2 }]);
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, state);
    expect(path).toEqual([]);
  });

  it("returns empty array when no path exists (blocked corridor)", () => {
    const blocked = [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
    ];
    const state = buildState(3, 3, blocked);
    const path = findPath({ x: 0, y: 1 }, { x: 2, y: 1 }, state);
    expect(path).toEqual([]);
  });

  it("handles start equals end", () => {
    const state = buildState(3, 3);
    const path = findPath({ x: 1, y: 1 }, { x: 1, y: 1 }, state);
    expect(path).toEqual([]);
  });

  it("finds shortest path in an open grid", () => {
    const state = buildState(4, 4);
    const path = findPath({ x: 0, y: 0 }, { x: 3, y: 3 }, state);
    expect(path.length).toBeGreaterThanOrEqual(6);
  });
});
