import { describe, expect, it } from "vitest";
import { createGridConfig } from "../../src/core/grid/GridConfig";
import { GridState } from "../../src/grid/GridState";
import { findPathWithFootprint } from "../../src/grid/Pathfinder";

function buildState(
  width: number,
  height: number,
  blocked: { col: number; row: number }[] = [],
): GridState {
  const config = createGridConfig({ gridWidth: width, gridHeight: height });
  const state = new GridState(config);
  for (const b of blocked) {
    const cell = state.getCell(b);
    if (cell) {
      state.setCell(b, { ...cell, type: "blocked" });
    }
  }
  return state;
}

const smallConfig = createGridConfig({ gridWidth: 5, gridHeight: 5 });

describe("findPathWithFootprint", () => {
  it("finds path for 1x1 goblin through open grid", () => {
    const state = buildState(5, 5);
    const path = findPathWithFootprint({ col: 0, row: 0 }, { col: 4, row: 4 }, state, smallConfig, "goblin");
    expect(path.length).toBeGreaterThan(0);
  });

  it("avoids a 1x2 skeleton blocking the path", () => {
    const state = buildState(5, 5);
    state.occupyCell({ col: 3, row: 2 }, "skeleton-1");
    state.occupyCell({ col: 3, row: 3 }, "skeleton-1");
    const path = findPathWithFootprint({ col: 0, row: 0 }, { col: 4, row: 4 }, state, smallConfig, "goblin");
    expect(path.length).toBeGreaterThan(0);
    for (const p of path) {
      expect(p.col === 3 && (p.row === 2 || p.row === 3)).toBe(false);
    }
  });

  it("returns empty if skeleton's 1x2 footprint cannot fit at start", () => {
    const config = createGridConfig({ gridWidth: 3, gridHeight: 3 });
    const state = new GridState(config);
    const path = findPathWithFootprint({ col: 2, row: 2 }, { col: 0, row: 0 }, state, config, "skeleton");
    expect(path).toEqual([]);
  });

  it("skeleton cannot pass through a 1-cell-wide gap", () => {
    const config = createGridConfig({ gridWidth: 3, gridHeight: 4 });
    const state = new GridState(config);
    state.occupyCell({ col: 1, row: 0 }, "blocker");
    state.occupyCell({ col: 1, row: 2 }, "blocker");
    const path = findPathWithFootprint({ col: 0, row: 0 }, { col: 2, row: 3 }, state, config, "skeleton");
    expect(path.length).toBe(0);
  });

  it("goblin can pass where skeleton cannot", () => {
    const config = createGridConfig({ gridWidth: 3, gridHeight: 4 });
    const state = new GridState(config);
    state.occupyCell({ col: 1, row: 0 }, "blocker");
    state.occupyCell({ col: 1, row: 2 }, "blocker");
    const goblinPath = findPathWithFootprint({ col: 0, row: 0 }, { col: 2, row: 3 }, state, config, "goblin");
    expect(goblinPath.length).toBeGreaterThan(0);
  });

  it("blocks 1x1 entity when corridor is completely occupied", () => {
    const state = buildState(3, 3);
    state.occupyCell({ col: 1, row: 0 }, "tower");
    state.occupyCell({ col: 1, row: 1 }, "tower");
    state.occupyCell({ col: 1, row: 2 }, "tower");
    const path = findPathWithFootprint({ col: 0, row: 0 }, { col: 2, row: 0 }, state, smallConfig, "goblin");
    expect(path.length).toBe(0);
  });
});
