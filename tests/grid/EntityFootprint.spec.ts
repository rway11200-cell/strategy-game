import { describe, expect, it } from "vitest";
import { createGridConfig } from "../../src/core/grid/GridConfig";
import { GridState } from "../../src/grid/GridState";
import {
  getEntityFootprint,
  getFootprintCellsForPos,
  isFootprintWalkable,
} from "../../src/grid/EntityFootprint";

describe("getEntityFootprint", () => {
  it("returns 1x1 for goblin", () => {
    expect(getEntityFootprint("goblin")).toEqual({ width: 1, height: 1 });
  });

  it("returns 1x2 for skeleton", () => {
    expect(getEntityFootprint("skeleton")).toEqual({ width: 1, height: 2 });
  });

  it("returns 1x1 for ghost", () => {
    expect(getEntityFootprint("ghost")).toEqual({ width: 1, height: 1 });
  });

  it("returns 1x1 for unknown entity type", () => {
    expect(getEntityFootprint("unknown")).toEqual({ width: 1, height: 1 });
  });
});

describe("getFootprintCellsForPos", () => {
  it("returns 1 cell for 1x1", () => {
    const cells = getFootprintCellsForPos({ col: 3, row: 5 }, 1, 1);
    expect(cells).toEqual([{ col: 3, row: 5 }]);
  });

  it("returns 2 cells for 1x2 vertical", () => {
    const cells = getFootprintCellsForPos({ col: 2, row: 3 }, 1, 2);
    expect(cells).toEqual([
      { col: 2, row: 3 },
      { col: 2, row: 4 },
    ]);
  });

  it("returns 4 cells for 2x2", () => {
    const cells = getFootprintCellsForPos({ col: 1, row: 1 }, 2, 2);
    expect(cells).toEqual([
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ]);
  });
});

describe("isFootprintWalkable", () => {
  it("returns true for 1x1 on empty grid", () => {
    const config = createGridConfig({ gridWidth: 5, gridHeight: 5 });
    const state = new GridState(config);
    expect(isFootprintWalkable({ col: 2, row: 2 }, 1, 1, state, config)).toBe(true);
  });

  it("returns false if any cell is occupied", () => {
    const config = createGridConfig({ gridWidth: 5, gridHeight: 5 });
    const state = new GridState(config);
    state.occupyCell({ col: 2, row: 3 }, "blocker");
    expect(isFootprintWalkable({ col: 2, row: 2 }, 1, 2, state, config)).toBe(false);
  });

  it("returns false if footprint goes out of bounds", () => {
    const config = createGridConfig({ gridWidth: 3, gridHeight: 3 });
    const state = new GridState(config);
    expect(isFootprintWalkable({ col: 2, row: 2 }, 1, 2, state, config)).toBe(false);
  });

  it("returns true for 1x2 when both cells are free", () => {
    const config = createGridConfig({ gridWidth: 5, gridHeight: 5 });
    const state = new GridState(config);
    expect(isFootprintWalkable({ col: 1, row: 1 }, 1, 2, state, config)).toBe(true);
  });
});
