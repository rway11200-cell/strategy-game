import { type GridConfig } from "../core/grid/GridConfig";
import { type CellCoord } from "./GridConfig";
import { type CellState, GridState } from "./GridState";
import { findPath } from "./Pathfinder";

export interface GridPathRequest {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
}

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

  calculatePath(): { x: number; y: number }[] {
    const path = findPath(
      { x: this.spawn.col, y: this.spawn.row },
      { x: this.base.col, y: this.base.row },
      this.gridState,
    );
    return path.map((p) => this.gridToWorld(p.x, p.y));
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

  private gridToWorld(col: number, row: number): { x: number; y: number } {
    const { cellSize, offsetX, offsetY } = this.gridConfig;
    return {
      x: offsetX + col * cellSize + cellSize / 2,
      y: offsetY + row * cellSize + cellSize / 2,
    };
  }
}
