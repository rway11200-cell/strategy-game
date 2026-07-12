import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { CellEvents, type CellCoord } from "../../src/grid/CellEvents";
import { createGridConfig } from "../../src/core/grid/GridConfig";

function makeConfig() {
  return createGridConfig({ cellSize: 64, gridWidth: 3, gridHeight: 3, offsetX: 0, offsetY: 0 });
}

describe("CellEvents", () => {
  describe("onClick", () => {
    it("fires with the correct cell coordinates on pointerdown", () => {
      const config = makeConfig();
      const clicked: CellCoord[] = [];
      const events = new CellEvents(config, { onClick: (c) => clicked.push(c) });
      events.router.handlePointerDown(32, 32);
      expect(clicked).toEqual([{ col: 0, row: 0 }]);
    });

    it("fires for a cell in the middle of the grid", () => {
      const config = makeConfig();
      const clicked: CellCoord[] = [];
      const events = new CellEvents(config, { onClick: (c) => clicked.push(c) });
      events.router.handlePointerDown(150, 100);
      expect(clicked).toEqual([{ col: 2, row: 1 }]);
    });

    it("does not fire when clicking outside the grid", () => {
      const config = makeConfig();
      const clicked: CellCoord[] = [];
      const events = new CellEvents(config, { onClick: (c) => clicked.push(c) });
      events.router.handlePointerDown(-10, -10);
      expect(clicked).toHaveLength(0);
    });
  });

  describe("onEnter / onLeave", () => {
    it("fires onEnter when pointer moves into a cell", () => {
      const config = makeConfig();
      const entered: CellCoord[] = [];
      const events = new CellEvents(config, { onEnter: (c) => entered.push(c) });
      events.router.handlePointerMove(32, 32);
      expect(entered).toEqual([{ col: 0, row: 0 }]);
    });

    it("fires onLeave when pointer moves out of the grid", () => {
      const config = makeConfig();
      const left: CellCoord[] = [];
      const events = new CellEvents(config, {
        onEnter: () => {},
        onLeave: (c) => left.push(c),
      });
      events.router.handlePointerMove(32, 32);
      events.router.handlePointerMove(-10, -10);
      expect(left).toEqual([{ col: 0, row: 0 }]);
    });

    it("fires onLeave then onEnter when moving between cells", () => {
      const config = makeConfig();
      const entered: CellCoord[] = [];
      const left: CellCoord[] = [];
      const events = new CellEvents(config, {
        onEnter: (c) => entered.push(c),
        onLeave: (c) => left.push(c),
      });

      events.router.handlePointerMove(32, 32);
      events.router.handlePointerMove(100, 32);
      expect(left).toEqual([{ col: 0, row: 0 }]);
      expect(entered).toEqual([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
      ]);
    });

    it("does not fire onEnter again when hovering the same cell", () => {
      const config = makeConfig();
      const entered: CellCoord[] = [];
      const events = new CellEvents(config, { onEnter: (c) => entered.push(c) });
      events.router.handlePointerMove(32, 32);
      events.router.handlePointerMove(40, 40);
      expect(entered).toHaveLength(1);
    });
  });

  describe("onHover", () => {
    it("fires on every pointer move within the grid", () => {
      const config = makeConfig();
      const hovered: CellCoord[] = [];
      const events = new CellEvents(config, { onHover: (c) => hovered.push(c) });
      events.router.handlePointerMove(32, 32);
      events.router.handlePointerMove(40, 40);
      expect(hovered).toHaveLength(2);
    });
  });

  describe("attach / detach", () => {
    it("attaches overlay to the container", () => {
      const events = new CellEvents(makeConfig());
      const container = new Container();
      events.attach(container);
      expect(container.children).toHaveLength(1);
      expect(container.children[0]).toBe(events.getOverlay());
    });

    it("detach removes the overlay from the container and clears state", () => {
      const clicked: CellCoord[] = [];
      const events = new CellEvents(makeConfig(), { onClick: (c) => clicked.push(c) });
      const container = new Container();
      events.attach(container);
      events.detach();
      expect(container.children).toHaveLength(0);
    });
  });
});
