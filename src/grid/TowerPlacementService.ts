import type { CellCoord, GridConfig } from "../core/grid/GridConfig";
import { type FootprintSize } from "./OccupationFootprint";
import { GridIntegration } from "./GridIntegration";

export type PlacementResult =
  | { success: true }
  | { success: false; reason: "out_of_bounds" | "cell_occupied" | "insufficient_coins" };

export interface TowerPlacementConfig {
  gridIntegration: GridIntegration;
  gridConfig: GridConfig;
  towerCost: number;
  hasCoins: () => number;
  deductCoins: (amount: number) => void;
}

export class TowerPlacementService {
  private config: TowerPlacementConfig;

  constructor(config: TowerPlacementConfig) {
    this.config = config;
  }

  canPlaceAt(coord: CellCoord, footprintSize: FootprintSize): PlacementResult {
    if (
      coord.col < 0 ||
      coord.col >= this.config.gridConfig.gridWidth ||
      coord.row < 0 ||
      coord.row >= this.config.gridConfig.gridHeight
    ) {
      return { success: false, reason: "out_of_bounds" };
    }

    if (!this.config.gridIntegration.canPlaceFootprint(coord.col, coord.row, footprintSize)) {
      return { success: false, reason: "cell_occupied" };
    }

    if (this.config.hasCoins() < this.config.towerCost) {
      return { success: false, reason: "insufficient_coins" };
    }

    return { success: true };
  }

  placeAt(coord: CellCoord, footprintSize: FootprintSize): PlacementResult {
    const check = this.canPlaceAt(coord, footprintSize);
    if (!check.success) return check;

    const occupantId = `tower-${coord.col}-${coord.row}`;
    const placed = this.config.gridIntegration.placeFootprint(coord.col, coord.row, footprintSize, occupantId);
    if (!placed) {
      return { success: false, reason: "cell_occupied" };
    }

    this.config.deductCoins(this.config.towerCost);
    return { success: true };
  }
}
