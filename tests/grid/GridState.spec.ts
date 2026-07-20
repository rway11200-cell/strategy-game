import { describe, expect, it } from "vitest";
import { type CellCoord, createDefaultGridConfig } from "../../src/grid/GridConfig";
import { CellState, GridState } from "../../src/grid/GridState";

function smallGrid(): GridState {
  return new GridState(createDefaultGridConfig({ gridWidth: 3, gridHeight: 3 }));
}

describe("GridState", () => {
  describe("getCell", () => {
    it("returns a cell at valid coordinates", () => {
      const gs = smallGrid();
      const cell = gs.getCell({ col: 1, row: 1 });
      expect(cell).toBeDefined();
      expect(cell!.type).toBe("walkable");
      expect(cell!.occupied).toBe(false);
      expect(cell!.walkCost).toBe(1);
    });

    it("returns undefined for out-of-bounds coordinates", () => {
      const gs = smallGrid();
      expect(gs.getCell({ col: -1, row: 0 })).toBeUndefined();
      expect(gs.getCell({ col: 0, row: -1 })).toBeUndefined();
      expect(gs.getCell({ col: 5, row: 0 })).toBeUndefined();
      expect(gs.getCell({ col: 0, row: 5 })).toBeUndefined();
    });
  });

  describe("setCell", () => {
    it("mutates a cell and returns the new state via getCell", () => {
      const gs = smallGrid();
      const coord: CellCoord = { col: 0, row: 0 };
      gs.setCell(coord, { type: "blocked", occupied: false, walkCost: 99 });
      const cell = gs.getCell(coord);
      expect(cell!.type).toBe("blocked");
      expect(cell!.walkCost).toBe(99);
    });

    it("does nothing when given out-of-bounds coordinates", () => {
      const gs = smallGrid();
      expect(() =>
        gs.setCell({ col: 99, row: 99 }, { type: "blocked", occupied: false, walkCost: 1 }),
      ).not.toThrow();
    });
  });

  describe("isWalkable", () => {
    it("returns true for a default walkable cell", () => {
      const gs = smallGrid();
      expect(gs.isWalkable({ col: 1, row: 1 })).toBe(true);
    });

    it("returns false for blocked cells", () => {
      const gs = smallGrid();
      const coord: CellCoord = { col: 0, row: 0 };
      gs.setCell(coord, { type: "blocked", occupied: false, walkCost: 1 });
      expect(gs.isWalkable(coord)).toBe(false);
    });

    it("returns false for occupied cells", () => {
      const gs = smallGrid();
      gs.occupyCell({ col: 1, row: 1 }, "tower-1");
      expect(gs.isWalkable({ col: 1, row: 1 })).toBe(false);
    });

    it("returns false for cells reserved by another unit", () => {
      const gs = smallGrid();
      const coord = { col: 1, row: 1 };
      expect(gs.reserveCell(coord, "unit-a")).toBe(true);
      expect(gs.isWalkable(coord, "unit-a")).toBe(true);
      expect(gs.isWalkable(coord, "unit-b")).toBe(false);
    });

    it("returns false for out-of-bounds", () => {
      const gs = smallGrid();
      expect(gs.isWalkable({ col: -1, row: 0 })).toBe(false);
    });
  });

  describe("occupyCell", () => {
    it("marks a cell as occupied with the given occupantId", () => {
      const gs = smallGrid();
      gs.occupyCell({ col: 2, row: 2 }, "enemy-1");
      const cell = gs.getCell({ col: 2, row: 2 });
      expect(cell!.occupied).toBe(true);
      expect(cell!.occupantId).toBe("enemy-1");
    });

    it("does nothing if the cell is already occupied", () => {
      const gs = smallGrid();
      const coord: CellCoord = { col: 1, row: 0 };
      gs.occupyCell(coord, "a");
      gs.occupyCell(coord, "b");
      expect(gs.getCell(coord)!.occupantId).toBe("a");
    });

    it("does nothing if the coordinates are out of bounds", () => {
      const gs = smallGrid();
      expect(() => gs.occupyCell({ col: 99, row: 99 }, "x")).not.toThrow();
    });
  });

  describe("reservations", () => {
    it("allows only the owner to occupy and release a reservation", () => {
      const gs = smallGrid();
      const coord = { col: 2, row: 1 };

      expect(gs.reserveCell(coord, "unit-a")).toBe(true);
      expect(gs.reserveCell(coord, "unit-b")).toBe(false);
      gs.occupyCell(coord, "unit-b");
      expect(gs.getCell(coord)?.occupied).toBe(false);

      gs.occupyCell(coord, "unit-a");
      expect(gs.getCell(coord)).toMatchObject({
        occupied: true,
        occupantId: "unit-a",
        reservedBy: undefined,
      });
    });

    it("releases only a reservation owned by the caller", () => {
      const gs = smallGrid();
      const coord = { col: 0, row: 1 };
      gs.reserveCell(coord, "unit-a");

      gs.releaseReservation(coord, "unit-b");
      expect(gs.getCell(coord)?.reservedBy).toBe("unit-a");
      gs.releaseReservation(coord, "unit-a");
      expect(gs.getCell(coord)?.reservedBy).toBeUndefined();
    });
  });

  describe("liberateCell", () => {
    it("clears the occupied flag and occupantId", () => {
      const gs = smallGrid();
      const coord: CellCoord = { col: 0, row: 2 };
      gs.occupyCell(coord, "player");
      gs.liberateCell(coord);
      const cell = gs.getCell(coord);
      expect(cell!.occupied).toBe(false);
      expect(cell!.occupantId).toBeUndefined();
    });

    it("does nothing if the cell is not occupied", () => {
      const gs = smallGrid();
      const coord: CellCoord = { col: 1, row: 1 };
      gs.liberateCell(coord);
      expect(gs.getCell(coord)!.occupied).toBe(false);
    });

    it("does nothing if the coordinates are out of bounds", () => {
      const gs = smallGrid();
      expect(() => gs.liberateCell({ col: 99, row: 99 })).not.toThrow();
    });
  });

  describe("onChange callback", () => {
    it("fires when setCell is called", () => {
      const gs = smallGrid();
      const events: { coord: CellCoord; previous: CellState; current: CellState }[] = [];
      gs.setOnChange((coord, prev, curr) => events.push({ coord, previous: prev, current: curr }));

      gs.setCell({ col: 0, row: 0 }, { type: "blocked", occupied: false, walkCost: 99 });

      expect(events).toHaveLength(1);
      expect(events[0].coord).toEqual({ col: 0, row: 0 });
      expect(events[0].previous.type).toBe("walkable");
      expect(events[0].current.type).toBe("blocked");
    });

    it("fires on occupyCell", () => {
      const gs = smallGrid();
      const events: CellCoord[] = [];
      gs.setOnChange((c) => events.push(c));

      gs.occupyCell({ col: 2, row: 2 }, "unit-1");
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ col: 2, row: 2 });
    });

    it("fires on liberateCell", () => {
      const gs = smallGrid();
      gs.occupyCell({ col: 1, row: 1 }, "tower");
      const events: CellCoord[] = [];
      gs.setOnChange((c) => events.push(c));

      gs.liberateCell({ col: 1, row: 1 });
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ col: 1, row: 1 });
    });

    it("does not fire when setCell is called on invalid coordinates", () => {
      const gs = smallGrid();
      let called = false;
      gs.setOnChange(() => (called = true));
      gs.setCell({ col: 99, row: 99 }, { type: "blocked", occupied: false, walkCost: 1 });
      expect(called).toBe(false);
    });

    it("can be cleared by setting null", () => {
      const gs = smallGrid();
      let called = false;
      gs.setOnChange(() => (called = true));
      gs.setOnChange(null);
      gs.setCell({ col: 0, row: 0 }, { type: "blocked", occupied: false, walkCost: 1 });
      expect(called).toBe(false);
    });
  });

  describe("grid dimensions", () => {
    it("creates a grid with the correct number of cells", () => {
      const config = createDefaultGridConfig({ gridWidth: 5, gridHeight: 7 });
      const gs = new GridState(config);
      const count = (() => {
        let total = 0;
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 5; c++) {
            if (gs.getCell({ col: c, row: r })) total++;
          }
        }
        return total;
      })();
      expect(count).toBe(35);
    });
  });
});
