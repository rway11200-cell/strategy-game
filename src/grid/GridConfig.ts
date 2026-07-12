export type CellType = "walkable" | "blocked" | "spawn" | "base" | "tower" | "path";

export interface CellCoord {
  col: number;
  row: number;
}

export interface GridConfig {
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  offsetX: number;
  offsetY: number;
}

const DEFAULT_GRID: GridConfig = {
  cellSize: 64,
  gridWidth: 20,
  gridHeight: 15,
  offsetX: 0,
  offsetY: 0,
};

export function createDefaultGridConfig(partial?: Partial<GridConfig>): GridConfig {
  return { ...DEFAULT_GRID, ...partial };
}
