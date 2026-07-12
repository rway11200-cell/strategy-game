/**
 * Represents the type of a cell on the game grid.
 * - Walkable: enemies can traverse this cell
 * - Blocked: cannot be traversed or built on
 * - Spawn: enemy spawn point
 * - Base: enemy destination / player base
 * - Tower: a tower has been built here
 */
export type CellType = "walkable" | "blocked" | "spawn" | "base" | "tower";

export const CELL_TYPES: readonly CellType[] = [
  "walkable",
  "blocked",
  "spawn",
  "base",
  "tower",
] as const;

/** Grid-local coordinates (column, row). */
export interface Point {
  x: number;
  y: number;
}

/** Configuration for a rectangular grid that overlays the world. */
export interface GridConfig {
  /** Pixel size of one cell (both width and height). */
  cellSize: number;
  /** Number of columns. */
  gridWidth: number;
  /** Number of rows. */
  gridHeight: number;
  /** World-space X offset of the grid origin (top-left). */
  offsetX: number;
  /** World-space Y offset of the grid origin (top-left). */
  offsetY: number;
}

/** Runtime state for a single cell on the grid. */
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

/**
 * Merges partial grid config with sensible defaults.
 */
export function createGridConfig(config: Partial<GridConfig> = {}): GridConfig {
  return { ...DEFAULT_GRID, ...config };
}

/**
 * Converts grid column/row to the world-space pixel center of that cell.
 */
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

/**
 * Converts world-space pixel coordinates to the nearest grid column/row.
 */
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
