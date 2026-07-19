import { type CellCoord, type CellType, type GridConfig } from "./GridConfig";

export interface CellState {
  type: CellType;
  occupied: boolean;
  occupantId?: string;
  walkCost: number;
}

export type CellChangeCallback = (coord: CellCoord, previous: CellState, current: CellState) => void;

export class GridState {
  private grid: CellState[][];
  private onChange: CellChangeCallback | null = null;

  constructor(config: GridConfig, initialType: CellType = "walkable") {
    this.grid = [];
    for (let row = 0; row < config.gridHeight; row++) {
      const rowData: CellState[] = [];
      for (let col = 0; col < config.gridWidth; col++) {
        rowData.push({
          type: initialType,
          occupied: false,
          walkCost: 1,
        });
      }
      this.grid.push(rowData);
    }
  }

  setOnChange(callback: CellChangeCallback | null): void {
    this.onChange = callback;
  }

  getCell(coord: CellCoord): CellState | undefined {
    return this.grid[coord.row]?.[coord.col];
  }

  setCell(coord: CellCoord, state: CellState): void {
    if (!this.grid[coord.row]?.[coord.col]) return;
    const previous = this.grid[coord.row][coord.col];
    this.grid[coord.row][coord.col] = state;
    this.onChange?.(coord, previous, state);
  }

  isWalkable(coord: CellCoord, ignoredOccupantId?: string): boolean {
    const cell = this.getCell(coord);
    if (!cell) return false;
    if (cell.occupied && cell.occupantId !== ignoredOccupantId) return false;
    if (cell.type === "blocked") return false;
    return true;
  }

  /**
   * Marks a cell as occupied by an entity.
   * Fires the onChange callback if set.
   */
  occupyCell(coord: CellCoord, occupantId: string): void {
    const cell = this.getCell(coord);
    if (!cell) return;
    if (cell.occupied) return;
    this.setCell(coord, { ...cell, occupied: true, occupantId });
  }

  /**
   * Releases a previously occupied cell.
   * Fires the onChange callback if set.
   */
  liberateCell(coord: CellCoord): void {
    const cell = this.getCell(coord);
    if (!cell) return;
    if (!cell.occupied) return;
    this.setCell(coord, { ...cell, occupied: false, occupantId: undefined });
  }
}
