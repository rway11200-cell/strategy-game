import { type CellCoord, type GridConfig } from "./GridConfig";
import type { EntityFootprintDef } from "./EntityFootprint";
import { GridState } from "./GridState";

export type FootprintSize = 1 | 2 | 3 | 4;

export const FOOTPRINT_SIZES: readonly FootprintSize[] = [1, 2, 3, 4];

export type OccupationFootprint = FootprintSize | EntityFootprintDef;

export interface Occupant {
  id: string;
  anchor: CellCoord;
  size: OccupationFootprint;
}

export interface FootprintValidation {
  valid: boolean;
  blockedCells: CellCoord[];
}

export interface PlaceFootprintResult {
  success: boolean;
  reason?: "out_of_bounds" | "overlaps_existing" | "anchor_occupied";
}

function cellsForFootprint(anchor: CellCoord, footprint: OccupationFootprint): CellCoord[] {
  const { width, height } =
    typeof footprint === "number" ? { width: footprint, height: footprint } : footprint;
  const colsBefore = Math.floor((width - 1) / 2);
  const colsAfter = Math.ceil((width - 1) / 2);
  const rowsBefore = Math.floor((height - 1) / 2);
  const rowsAfter = Math.ceil((height - 1) / 2);
  const cells: CellCoord[] = [];
  for (let dr = -rowsBefore; dr <= rowsAfter; dr++) {
    for (let dc = -colsBefore; dc <= colsAfter; dc++) {
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
  footprint: OccupationFootprint,
  config: GridConfig,
): FootprintValidation {
  const candidateCells = cellsForFootprint(anchor, footprint);
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
  footprint: OccupationFootprint,
  gridState: GridState,
  config: GridConfig,
): PlaceFootprintResult {
  const { valid } = getAllFootprintCells(anchor, footprint, config);
  if (!valid) {
    return { success: false, reason: "out_of_bounds" };
  }

  const allCells = cellsForFootprint(anchor, footprint);
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
  footprint: OccupationFootprint,
  occupantId: string,
  gridState: GridState,
  config: GridConfig,
): boolean {
  const check = canPlaceFootprint(anchor, footprint, gridState, config);
  if (!check.success) return false;

  const allCells = cellsForFootprint(anchor, footprint);
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
