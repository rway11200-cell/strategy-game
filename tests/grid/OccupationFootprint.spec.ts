import { describe, expect, it } from "vitest";
import { createGridConfig } from "../../src/core/grid/GridConfig";
import { createDefaultGridConfig } from "../../src/grid/GridConfig";
import { GridState } from "../../src/grid/GridState";
import { GridIntegration } from "../../src/grid/GridIntegration";
import {
  type FootprintSize,
  getAllFootprintCells,
  canPlaceFootprint,
  placeFootprint,
  removeFootprint,
  getOccupantCells,
} from "../../src/grid/OccupationFootprint";

function smallConfig() {
  return createDefaultGridConfig({ gridWidth: 6, gridHeight: 6 });
}

function freshState(): GridState {
  return new GridState(smallConfig());
}

describe("getAllFootprintCells", () => {
  it("returns 1 cell for size 1", () => {
    const result = getAllFootprintCells({ col: 3, row: 3 }, 1, smallConfig());
    expect(result.valid).toBe(true);
    expect(result.blockedCells).toEqual([]);
  });

  it("returns 4 cells for size 2", () => {
    const result = getAllFootprintCells({ col: 3, row: 3 }, 2, smallConfig());
    expect(result.valid).toBe(true);
  });

  it("returns 9 cells for size 3", () => {
    const result = getAllFootprintCells({ col: 3, row: 3 }, 3, smallConfig());
    expect(result.valid).toBe(true);
  });

  it("returns 16 cells for size 4", () => {
    const result = getAllFootprintCells({ col: 3, row: 3 }, 4, smallConfig());
    expect(result.valid).toBe(true);
  });

  it("detects out of bounds for an anchor too close to the edge", () => {
    const result = getAllFootprintCells({ col: 0, row: 0 }, 3, smallConfig());
    expect(result.valid).toBe(false);
    expect(result.blockedCells.length).toBeGreaterThan(0);
  });

  it("detects out of bounds near the bottom-right edge", () => {
    const result = getAllFootprintCells({ col: 5, row: 5 }, 3, smallConfig());
    expect(result.valid).toBe(false);
  });
});

describe("canPlaceFootprint", () => {
  it("returns success for a valid placement in empty grid", () => {
    const result = canPlaceFootprint({ col: 3, row: 3 }, 2, freshState(), smallConfig());
    expect(result.success).toBe(true);
  });

  it("rejects placement out of bounds", () => {
    const result = canPlaceFootprint({ col: 0, row: 0 }, 3, freshState(), smallConfig());
    expect(result.success).toBe(false);
    expect(result.reason).toBe("out_of_bounds");
  });

  it("rejects placement overlapping an existing occupant", () => {
    const state = freshState();
    placeFootprint({ col: 2, row: 2 }, 2, "existing", state, smallConfig());

    const result = canPlaceFootprint({ col: 3, row: 3 }, 2, state, smallConfig());
    expect(result.success).toBe(false);
    expect(result.reason).toBe("overlaps_existing");
  });
});

describe("placeFootprint", () => {
  it("occupies all cells in a 2x2 footprint", () => {
    const state = freshState();
    const placed = placeFootprint({ col: 2, row: 2 }, 2, "tower-A", state, smallConfig());
    expect(placed).toBe(true);

    expect(state.getCell({ col: 2, row: 2 })!.occupied).toBe(true);
    expect(state.getCell({ col: 2, row: 2 })!.occupantId).toBe("tower-A");
    expect(state.getCell({ col: 3, row: 2 })!.occupied).toBe(true);
    expect(state.getCell({ col: 2, row: 3 })!.occupied).toBe(true);
    expect(state.getCell({ col: 3, row: 3 })!.occupied).toBe(true);
  });

  it("occupies all cells in a 3x3 footprint", () => {
    const state = freshState();
    const placed = placeFootprint({ col: 3, row: 3 }, 3, "big-tower", state, smallConfig());
    expect(placed).toBe(true);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cell = state.getCell({ col: 3 + dc, row: 3 + dr })!;
        expect(cell.occupied).toBe(true);
        expect(cell.occupantId).toBe("big-tower");
      }
    }
  });

  it("rejects if any cell is already occupied", () => {
    const state = freshState();
    state.occupyCell({ col: 3, row: 2 }, "something");
    const placed = placeFootprint({ col: 2, row: 2 }, 2, "tower-B", state, smallConfig());
    expect(placed).toBe(false);
  });

  it("does not partially occupy cells on failure", () => {
    const state = freshState();
    state.occupyCell({ col: 3, row: 2 }, "blocker");
    placeFootprint({ col: 2, row: 2 }, 2, "tower-C", state, smallConfig());

    expect(state.getCell({ col: 2, row: 2 })!.occupied).toBe(false);
  });
});

describe("removeFootprint", () => {
  it("liberates all cells occupied by the given occupantId", () => {
    const state = freshState();
    placeFootprint({ col: 1, row: 1 }, 3, "tower-X", state, smallConfig());

    removeFootprint("tower-X", state, smallConfig());

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = state.getCell({ col: 1 + c, row: 1 + r })!;
        expect(cell.occupied).toBe(false);
        expect(cell.occupantId).toBeUndefined();
      }
    }
  });

  it("does not affect cells from a different occupant", () => {
    const state = freshState();
    placeFootprint({ col: 1, row: 1 }, 2, "tower-A", state, smallConfig());
    placeFootprint({ col: 4, row: 4 }, 1, "tower-B", state, smallConfig());

    removeFootprint("tower-A", state, smallConfig());

    expect(state.getCell({ col: 4, row: 4 })!.occupied).toBe(true);
    expect(state.getCell({ col: 4, row: 4 })!.occupantId).toBe("tower-B");
  });
});

describe("getOccupantCells", () => {
  it("returns all cells for a 2x2 footprint", () => {
    const state = freshState();
    placeFootprint({ col: 2, row: 2 }, 2, "my-tower", state, smallConfig());

    const cells = getOccupantCells("my-tower", state, smallConfig());
    expect(cells).toHaveLength(4);
    expect(cells).toContainEqual({ col: 2, row: 2 });
    expect(cells).toContainEqual({ col: 3, row: 3 });
  });

  it("returns empty when occupantId does not exist", () => {
    const cells = getOccupantCells("nonexistent", freshState(), smallConfig());
    expect(cells).toEqual([]);
  });
});

describe("footprint sizes", () => {
  (["1x1", "2x2", "3x3", "4x4"] as const).forEach((label) => {
    const size = parseInt(label) as FootprintSize;
    it(`places and removes a ${label} footprint correctly`, () => {
      const config = createDefaultGridConfig({ gridWidth: 10, gridHeight: 10 });
      const state = new GridState(config);

      const placed = placeFootprint({ col: 5, row: 5 }, size, `test-${size}`, state, config);
      expect(placed).toBe(true);

      const cells = getOccupantCells(`test-${size}`, state, config);
      expect(cells).toHaveLength(size * size);

      removeFootprint(`test-${size}`, state, config);

      const remaining = getOccupantCells(`test-${size}`, state, config);
      expect(remaining).toHaveLength(0);
    });
  });
});

describe("GridIntegration with footprints", () => {
  it("canPlaceFootprint works through GridIntegration", () => {
    const config = createGridConfig({ gridWidth: 8, gridHeight: 8 });
    const gi = new GridIntegration({ gridConfig: config, spawn: { col: 0, row: 0 }, base: { col: 7, row: 7 } });

    expect(gi.canPlaceFootprint(4, 4, 2)).toBe(true);
    expect(gi.canPlaceFootprint(0, 0, 3)).toBe(false);
  });

  it("placeFootprint and removeFootprint work through GridIntegration", () => {
    const config = createGridConfig({ gridWidth: 8, gridHeight: 8 });
    const gi = new GridIntegration({ gridConfig: config, spawn: { col: 0, row: 0 }, base: { col: 7, row: 7 } });

    const placed = gi.placeFootprint(3, 3, 2, "integration-tower");
    expect(placed).toBe(true);
    expect(gi.isWalkable(3, 3)).toBe(false);
    expect(gi.isWalkable(4, 4)).toBe(false);

    gi.removeFootprint("integration-tower");
    expect(gi.isWalkable(3, 3)).toBe(true);
  });
});
