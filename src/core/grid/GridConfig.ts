export type CellType = "walkable" | "blocked" | "spawn" | "base" | "tower" | "path";

export const CELL_TYPES: readonly CellType[] = [
  "walkable",
  "blocked",
  "spawn",
  "base",
  "tower",
  "path",
] as const;

export interface CellCoord {
  col: number;
  row: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface GridConfig {
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface CellState {
  type: CellType;
  position: Point;
  worldX: number;
  worldY: number;
}

const DEFAULT_GRID: GridConfig = {
  cellSize: 64,
  gridWidth: 20,
  gridHeight: 15,
  offsetX: 0,
  offsetY: 0,
};

export function createGridConfig(config: Partial<GridConfig> = {}): GridConfig {
  return { ...DEFAULT_GRID, ...config };
}

export function gridToWorld(
  gridX: number,
  gridY: number,
  config: GridConfig,
): { x: number; y: number } {
  return {
    x: config.offsetX + gridX * config.cellSize + config.cellSize / 2,
    y: config.offsetY + gridY * config.cellSize + config.cellSize / 2,
  };
}

export function worldToGrid(
  worldX: number,
  worldY: number,
  config: GridConfig,
): Point {
  return {
    x: Math.floor((worldX - config.offsetX) / config.cellSize),
    y: Math.floor((worldY - config.offsetY) / config.cellSize),
  };
}
