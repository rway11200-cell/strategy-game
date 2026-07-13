import { type CellCoord, type GridConfig } from "./GridConfig";
import { GridState } from "./GridState";

export type FootprintSize = 1 | 2 | 3 | 4;

export const FOOTPRINT_SIZES: readonly FootprintSize[] = [1, 2, 3, 4];

export interface Occupant {
  id: string;
  anchor: CellCoord;
  size: FootprintSize;
}

export interface FootprintValidation {
  valid: boolean;
  blockedCells: CellCoord[];
}

export interface PlaceFootprintResult {
  success: boolean;
  reason?: "out_of_bounds" | "overlaps_existing" | "anchor_occupied";
}

function cellsForFootprint(anchor: CellCoord, size: FootprintSize): CellCoord[] {
  const halfBefore = Math.floor((size - 1) / 2);
  const halfAfter = Math.ceil((size - 1) / 2);
  const cells: CellCoord[] = [];
  for (let dr = -halfBefore; dr <= halfAfter; dr++) {
    for (let dc = -halfBefore; dc <= halfAfter; dc++) {
      cells.push({ col: anchor.col + dc, row: anchor.row + dr });
    }
  }
  return cells;
}

function isInsideGrid(coord: CellCoord, config: GridConfig): boolean {
  return (
    coord.col >= 0 &&
    coord.col < config.gridWidth &&
    coord.row >= 0 &&
    coord.row < config.gridHeight
  );
}

export function getAllFootprintCells(
  anchor: CellCoord,
  size: FootprintSize,
  config: GridConfig,
): FootprintValidation {
  const candidateCells = cellsForFootprint(anchor, size);
  const blockedCells: CellCoord[] = [];

  for (const c of candidateCells) {
    if (!isInsideGrid(c, config)) {
      blockedCells.push(c);
    }
  }

  return {
    valid: blockedCells.length === 0,
    blockedCells,
  };
}

export function canPlaceFootprint(
  anchor: CellCoord,
  size: FootprintSize,
  gridState: GridState,
  config: GridConfig,
): PlaceFootprintResult {
  const { valid } = getAllFootprintCells(anchor, size, config);
  if (!valid) {
    return { success: false, reason: "out_of_bounds" };
  }

  const allCells = cellsForFootprint(anchor, size);
  for (const c of allCells) {
    const cell = gridState.getCell(c);
    if (!cell) {
      return { success: false, reason: "out_of_bounds" };
    }
    if (cell.occupied) {
      return { success: false, reason: "overlaps_existing" };
    }
  }

  const anchorCell = gridState.getCell(anchor);
  if (anchorCell?.occupied) {
    return { success: false, reason: "anchor_occupied" };
  }

  return { success: true };
}

export function placeFootprint(
  anchor: CellCoord,
  size: FootprintSize,
  occupantId: string,
  gridState: GridState,
  config: GridConfig,
): boolean {
  const check = canPlaceFootprint(anchor, size, gridState, config);
  if (!check.success) return false;

  const allCells = cellsForFootprint(anchor, size);
  for (const c of allCells) {
    gridState.occupyCell(c, occupantId);
  }

  return true;
}

export function removeFootprint(
  occupantId: string,
  gridState: GridState,
  config: GridConfig,
): void {
  for (let row = 0; row < config.gridHeight; row++) {
    for (let col = 0; col < config.gridWidth; col++) {
      const coord: CellCoord = { col, row };
      const cell = gridState.getCell(coord);
      if (cell && cell.occupied && cell.occupantId === occupantId) {
        gridState.liberateCell(coord);
      }
    }
  }
}

export function getOccupantCells(
  occupantId: string,
  gridState: GridState,
  config: GridConfig,
): CellCoord[] {
  const result: CellCoord[] = [];
  for (let row = 0; row < config.gridHeight; row++) {
    for (let col = 0; col < config.gridWidth; col++) {
      const coord: CellCoord = { col, row };
      const cell = gridState.getCell(coord);
      if (cell && cell.occupied && cell.occupantId === occupantId) {
        result.push(coord);
      }
    }
  }
  return result;
}
