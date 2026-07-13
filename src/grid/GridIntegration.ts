import { gridToWorld, type GridConfig } from "../core/grid/GridConfig";
import { type CellCoord } from "./GridConfig";
import { type CellState, GridState } from "./GridState";
import { findPath } from "./Pathfinder";

export interface GridIntegrationConfig {
  gridConfig: GridConfig;
  blockedCells?: CellCoord[];
  spawn: CellCoord;
  base: CellCoord;
}

export class GridIntegration {
  public readonly gridState: GridState;
  public readonly spawn: CellCoord;
  public readonly base: CellCoord;
  private gridConfig: GridConfig;

  constructor(config: GridIntegrationConfig) {
    this.gridConfig = config.gridConfig;
    this.spawn = config.spawn;
    this.base = config.base;
    this.gridState = new GridState(config.gridConfig);

    for (const cell of config.blockedCells ?? []) {
      const existing = this.gridState.getCell(cell);
      if (existing) {
        this.gridState.setCell(cell, { ...existing, type: "blocked", walkCost: 99 });
      }
    }
  }

  /**
   * Computes a path from spawn to base using A*.
   * Returns world-space pixel coordinates so the result can be
   * passed directly to the movement system.
   */
  calculatePath(): { x: number; y: number }[] {
    const path = findPath(this.spawn, this.base, this.gridState);
    return path.map((c) => gridToWorld(c.col, c.row, this.gridConfig));
  }

  isWalkable(col: number, row: number): boolean {
    return this.gridState.isWalkable({ col, row });
  }

  occupyCell(col: number, row: number, occupantId: string): void {
    this.gridState.occupyCell({ col, row }, occupantId);
  }

  liberateCell(col: number, row: number): void {
    this.gridState.liberateCell({ col, row });
  }

  getCell(col: number, row: number): CellState | undefined {
    return this.gridState.getCell({ col, row });
  }

  setCell(col: number, row: number, state: CellState): void {
    this.gridState.setCell({ col, row }, state);
  }
}
