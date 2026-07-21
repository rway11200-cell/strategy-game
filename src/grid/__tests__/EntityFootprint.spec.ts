import { describe, expect, it } from "vitest";
import { createDefaultGridConfig } from "../GridConfig";
import {
  ENTITY_FOOTPRINTS,
  getEntityFootprint,
  getFootprintCellsForPos,
  isFootprintWalkable,
} from "../EntityFootprint";
import { GridState } from "../GridState";
import { getAllFootprintCells, placeFootprint } from "../OccupationFootprint";

describe("ENTITY_FOOTPRINTS", () => {
  it("contains every game entity footprint", () => {
    expect(ENTITY_FOOTPRINTS).toEqual({
      goblin: { width: 1, height: 1 },
      skeleton: { width: 1, height: 1 },
      ghost: { width: 1, height: 1 },
      tower: { width: 2, height: 2 },
      mine: { width: 3, height: 3 },
      base: { width: 4, height: 4 },
    });
    expect(getEntityFootprint("mine")).toEqual({ width: 3, height: 3 });
  });
});

describe("getFootprintCellsForPos", () => {
  it("returns every cell in a rectangular footprint from its anchor", () => {
    expect(getFootprintCellsForPos({ col: 2, row: 3 }, 2, 3)).toEqual([
      { col: 2, row: 3 },
      { col: 3, row: 3 },
      { col: 2, row: 4 },
      { col: 3, row: 4 },
      { col: 2, row: 5 },
      { col: 3, row: 5 },
    ]);
  });

  it("is rejected when any generated cell is outside the grid", () => {
    const config = createDefaultGridConfig({ gridWidth: 4, gridHeight: 4 });
    const state = new GridState(config);

    expect(isFootprintWalkable({ col: 3, row: 2 }, 2, 2, state, config)).toBe(false);
    expect(isFootprintWalkable({ col: -1, row: 0 }, 1, 1, state, config)).toBe(false);
  });
});

describe("rectangular occupation footprints", () => {
  it("places every cell in the skeleton 1x1 footprint", () => {
    const config = createDefaultGridConfig({ gridWidth: 4, gridHeight: 4 });
    const state = new GridState(config);
    const skeleton = getEntityFootprint("skeleton");

    expect(placeFootprint({ col: 1, row: 1 }, skeleton, "skeleton-1", state, config)).toBe(true);
    expect(state.getCell({ col: 1, row: 1 })?.occupantId).toBe("skeleton-1");
  });

  it("validates rectangular footprints against grid limits", () => {
    const config = createDefaultGridConfig({ gridWidth: 4, gridHeight: 4 });
    const skeleton = getEntityFootprint("skeleton");

    expect(getAllFootprintCells({ col: 3, row: 3 }, skeleton, config)).toEqual({
      valid: true,
      blockedCells: [],
    });
  });
});
