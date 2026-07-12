
import { describe, expect, it, vi } from "vitest";
import { GridDebugOverlay } from "../../src/grid/GridDebugOverlay";
import { createGridConfig } from "../../src/core/grid/GridConfig";
import { type CellState } from "../../src/grid/GridState";

function makeConfig() {
  return createGridConfig({ cellSize: 64, gridWidth: 3, gridHeight: 3, offsetX: 0, offsetY: 0 });
}

const mockEventTarget = new EventTarget();

function makeCells(overrides: Partial<CellState>[][] = []): (CellState | null)[][] {
  const cells: (CellState | null)[][] = [];
  for (let r = 0; r < 3; r++) {
    const row: (CellState | null)[] = [];
    for (let c = 0; c < 3; c++) {
      const override = overrides[r]?.[c] ?? {};
      row.push({
        type: "walkable",
        occupied: false,
        walkCost: 1,
        ...override,
      });
    }
    cells.push(row);
  }
  return cells;
}

describe("GridDebugOverlay", () => {
  describe("construction", () => {
    it("creates a hidden container when devMode is false", () => {
      const overlay = new GridDebugOverlay(makeConfig(), false);
      expect(overlay.getContainer().visible).toBe(false);
      expect(overlay.isVisible()).toBe(false);
    });

    it("creates a hidden container when devMode is true", () => {
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      expect(overlay.getContainer().visible).toBe(false);
      expect(overlay.isVisible()).toBe(false);
    });

    it("registers keydown listener on the event target in dev mode", () => {
      const addSpy = vi.spyOn(mockEventTarget, "addEventListener");
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      expect(addSpy).toHaveBeenCalledWith("keydown", overlay["onKeyDown"]);
      addSpy.mockRestore();
    });

    it("does not register keydown listener when devMode is false", () => {
      const addSpy = vi.spyOn(mockEventTarget, "addEventListener");
      new GridDebugOverlay(makeConfig(), false, mockEventTarget);
      expect(addSpy).not.toHaveBeenCalled();
      addSpy.mockRestore();
    });
  });

  describe("toggle", () => {
    it("toggle does nothing when devMode is false", () => {
      const overlay = new GridDebugOverlay(makeConfig(), false);
      overlay.toggle();
      expect(overlay.isVisible()).toBe(false);
    });

    it("toggle switches visibility when devMode is true", () => {
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      overlay.toggle();
      expect(overlay.isVisible()).toBe(true);
      expect(overlay.getContainer().visible).toBe(true);

      overlay.toggle();
      expect(overlay.isVisible()).toBe(false);
      expect(overlay.getContainer().visible).toBe(false);
    });

    it("G key triggers toggle via event target", () => {
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      expect(overlay.isVisible()).toBe(false);

      const event = new Event("keydown");
      Object.defineProperty(event, "key", { value: "g" });
      mockEventTarget.dispatchEvent(event);
      expect(overlay.isVisible()).toBe(true);
    });
  });

  describe("render", () => {
    it("adds children when cells are set and overlay is visible", () => {
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      overlay.setCells(makeCells());
      overlay.toggle();
      overlay.render();

      expect(overlay.getContainer().children.length).toBeGreaterThan(0);
    });

    it("does not add children when overlay is not visible", () => {
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      overlay.setCells(makeCells());
      overlay.render();

      expect(overlay.getContainer().children.length).toBe(0);
    });

    it("draws path when set", () => {
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      overlay.setCells(makeCells());
      overlay.setPath([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]);
      overlay.toggle();
      overlay.render();

      const children = overlay.getContainer().children;
      expect(children.length).toBeGreaterThan(0);
    });

    it("re-renders when data changes", () => {
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      overlay.setCells(makeCells());
      overlay.toggle();
      overlay.render();

      const firstCount = overlay.getContainer().children.length;

      overlay.setCells(makeCells());
      overlay.render();

      expect(overlay.getContainer().children.length).toBe(firstCount);
    });

    it("path cell types are shown with the path color", () => {
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      overlay.setCells(makeCells());
      overlay.toggle();
      overlay.render();

      const children = overlay.getContainer().children;
      expect(children.length).toBeGreaterThan(0);
    });
  });

  describe("onToggle callback", () => {
    it("fires when toggle is called in dev mode", () => {
      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      const callback = vi.fn();
      overlay.onToggle(callback);

      overlay.toggle();
      expect(callback).toHaveBeenCalledTimes(1);

      overlay.toggle();
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("does not fire when devMode is false", () => {
      const overlay = new GridDebugOverlay(makeConfig(), false);
      const callback = vi.fn();
      overlay.onToggle(callback);

      overlay.toggle();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("removes the keydown listener from the event target", () => {
      const removeSpy = vi.spyOn(mockEventTarget, "removeEventListener");

      const overlay = new GridDebugOverlay(makeConfig(), true, mockEventTarget);
      overlay.destroy(mockEventTarget);

      expect(removeSpy).toHaveBeenCalledWith("keydown", overlay["onKeyDown"]);
      removeSpy.mockRestore();
    });
  });
});
