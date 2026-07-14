import type { CellCoord, GridConfig } from "./GridConfig";
import { GridState } from "./GridState";

export interface EntityFootprintDef {
  width: number;
  height: number;
}

const FOOTPRINTS: Record<string, EntityFootprintDef> = {
  goblin: { width: 1, height: 1 },
  skeleton: { width: 1, height: 2 },
  ghost: { width: 1, height: 1 },
};

export function getEntityFootprint(entityType: string): EntityFootprintDef {
  return FOOTPRINTS[entityType] ?? { width: 1, height: 1 };
}

export function getFootprintCellsForPos(
  anchor: CellCoord,
  width: number,
  height: number,
): CellCoord[] {
  const cells: CellCoord[] = [];
  for (let dr = 0; dr < height; dr++) {
    for (let dc = 0; dc < width; dc++) {
      cells.push({ col: anchor.col + dc, row: anchor.row + dr });
    }
  }
  return cells;
}

export function isFootprintWalkable(
  anchor: CellCoord,
  width: number,
  height: number,
  gridState: GridState,
  config: GridConfig,
): boolean {
  const cells = getFootprintCellsForPos(anchor, width, height);
  for (const c of cells) {
    if (
      c.col < 0 ||
      c.col >= config.gridWidth ||
      c.row < 0 ||
      c.row >= config.gridHeight
    ) {
      return false;
    }
    if (!gridState.isWalkable(c)) return false;
  }
  return true;
}
