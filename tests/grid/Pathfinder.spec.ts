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
    const path = findPath({ col: 0, row: 0 }, { col: 4, row: 0 }, state);
    expect(path).toEqual([
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
      { col: 4, row: 0 },
    ]);
  });

  it("finds a straight vertical path", () => {
    const state = buildState(1, 5);
    const path = findPath({ col: 0, row: 0 }, { col: 0, row: 4 }, state);
    expect(path).toEqual([
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 0, row: 3 },
      { col: 0, row: 4 },
    ]);
  });

  it("navigates around an obstacle", () => {
    const state = buildState(3, 3, [{ col: 1, row: 0 }]);
    const path = findPath({ col: 0, row: 0 }, { col: 2, row: 0 }, state);
    expect(path).not.toHaveLength(0);
    const last = path[path.length - 1];
    expect(last).toEqual({ col: 2, row: 0 });
  });

  it("returns empty array when start is blocked", () => {
    const state = buildState(3, 3, [{ col: 0, row: 0 }]);
    const path = findPath({ col: 0, row: 0 }, { col: 2, row: 2 }, state);
    expect(path).toEqual([]);
  });

  it("returns empty array when end is blocked", () => {
    const state = buildState(3, 3, [{ col: 2, row: 2 }]);
    const path = findPath({ col: 0, row: 0 }, { col: 2, row: 2 }, state);
    expect(path).toEqual([]);
  });

  it("returns empty array when no path exists (blocked corridor)", () => {
    const blocked = [
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
    ];
    const state = buildState(3, 3, blocked);
    const path = findPath({ col: 0, row: 1 }, { col: 2, row: 1 }, state);
    expect(path).toEqual([]);
  });

  it("handles start equals end", () => {
    const state = buildState(3, 3);
    const path = findPath({ col: 1, row: 1 }, { col: 1, row: 1 }, state);
    expect(path).toEqual([]);
  });

  it("finds shortest path in an open grid", () => {
    const state = buildState(4, 4);
    const path = findPath({ col: 0, row: 0 }, { col: 3, row: 3 }, state);
    expect(path.length).toBe(3);
  });
});
