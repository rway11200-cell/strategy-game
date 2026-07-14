import { describe, expect, it } from "vitest";
import { createGridConfig } from "../../src/core/grid/GridConfig";
import { GridIntegration } from "../../src/grid/GridIntegration";
import { TowerPlacementService, type TowerPlacementConfig } from "../../src/grid/TowerPlacementService";

function makeService(coins = 100): TowerPlacementService {
  const gridConfig = createGridConfig({ gridWidth: 5, gridHeight: 5, cellSize: 64 });
  const gi = new GridIntegration({ gridConfig, spawn: { col: 0, row: 0 }, base: { col: 4, row: 4 } });
  let currentCoins = coins;
  const config: TowerPlacementConfig = {
    gridIntegration: gi,
    gridConfig,
    towerCost: 50,
    hasCoins: () => currentCoins,
    deductCoins: (amount: number) => { currentCoins -= amount; },
  };
  return new TowerPlacementService(config);
}

describe("TowerPlacementService", () => {
  describe("canPlaceAt", () => {
    it("returns success for a valid empty cell", () => {
      const svc = makeService();
      const result = svc.canPlaceAt({ col: 2, row: 2 }, 1);
      expect(result).toEqual({ success: true });
    });

    it("rejects out-of-bounds cell", () => {
      const svc = makeService();
      const result = svc.canPlaceAt({ col: -1, row: 0 }, 1);
      expect(result).toEqual({ success: false, reason: "out_of_bounds" });
    });

    it("rejects cell that exceeds grid width", () => {
      const svc = makeService();
      const result = svc.canPlaceAt({ col: 5, row: 0 }, 1);
      expect(result).toEqual({ success: false, reason: "out_of_bounds" });
    });

    it("rejects cell that exceeds grid height", () => {
      const svc = makeService();
      const result = svc.canPlaceAt({ col: 0, row: 5 }, 1);
      expect(result).toEqual({ success: false, reason: "out_of_bounds" });
    });

    it("rejects cell already occupied by a footprint", () => {
      const svc = makeService();
      svc.placeAt({ col: 2, row: 2 }, 1);
      const result = svc.canPlaceAt({ col: 2, row: 2 }, 1);
      expect(result).toEqual({ success: false, reason: "cell_occupied" });
    });

    it("rejects placement when coins are insufficient", () => {
      const svc = makeService(30);
      const result = svc.canPlaceAt({ col: 2, row: 2 }, 1);
      expect(result).toEqual({ success: false, reason: "insufficient_coins" });
    });
  });

  describe("placeAt", () => {
    it("places a tower at a valid empty cell", () => {
      const svc = makeService();
      const result = svc.placeAt({ col: 1, row: 1 }, 1);
      expect(result).toEqual({ success: true });
    });

    it("occupies the cell after placement", () => {
      const svc = makeService();
      svc.placeAt({ col: 3, row: 3 }, 1);
      const retry = svc.canPlaceAt({ col: 3, row: 3 }, 1);
      expect(retry).toEqual({ success: false, reason: "cell_occupied" });
    });

    it("deducts coins on successful placement", () => {
      const gridConfig = createGridConfig({ gridWidth: 5, gridHeight: 5, cellSize: 64 });
      const gi = new GridIntegration({ gridConfig, spawn: { col: 0, row: 0 }, base: { col: 4, row: 4 } });
      let coins = 100;
      const svc = new TowerPlacementService({
        gridIntegration: gi,
        gridConfig,
        towerCost: 75,
        hasCoins: () => coins,
        deductCoins: (amount: number) => { coins -= amount; },
      });

      svc.placeAt({ col: 2, row: 2 }, 1);
      expect(coins).toBe(25);
    });

    it("does not deduct coins on failed placement", () => {
      const gridConfig = createGridConfig({ gridWidth: 5, gridHeight: 5, cellSize: 64 });
      const gi = new GridIntegration({ gridConfig, spawn: { col: 0, row: 0 }, base: { col: 4, row: 4 } });
      let coins = 100;
      const svc = new TowerPlacementService({
        gridIntegration: gi,
        gridConfig,
        towerCost: 50,
        hasCoins: () => coins,
        deductCoins: (amount: number) => { coins -= amount; },
      });

      svc.placeAt({ col: 2, row: 2 }, 1);
      svc.placeAt({ col: 2, row: 2 }, 1);
      expect(coins).toBe(50);
    });

    it("rejects placement at occupied cell", () => {
      const svc = makeService();
      svc.placeAt({ col: 0, row: 0 }, 1);
      const result = svc.placeAt({ col: 0, row: 0 }, 1);
      expect(result).toEqual({ success: false, reason: "cell_occupied" });
    });

    it("rejects placement when out of bounds", () => {
      const svc = makeService();
      const result = svc.placeAt({ col: 99, row: 99 }, 1);
      expect(result).toEqual({ success: false, reason: "out_of_bounds" });
    });

    it("rejects placement when coins are insufficient", () => {
      const svc = makeService(30);
      const result = svc.placeAt({ col: 3, row: 3 }, 1);
      expect(result).toEqual({ success: false, reason: "insufficient_coins" });
    });
  });
});
