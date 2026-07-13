import type { CellState } from "../GridState";
import type { CellRenderData } from "./GridRenderAdapter";

/**
 * Converts the internal GridState cell matrix into CellRenderData[][]
 * that can be consumed by any GridRenderAdapter implementation.
 * Each cell gets its col/row filled from the array indices.
 */
export function gridStateToCellData(cells: (CellState | null)[][]): CellRenderData[][] {
  return cells.map((row, rowIndex) =>
    row.map((cell, colIndex) =>
      cell
        ? {
            col: colIndex,
            row: rowIndex,
            type: cell.type,
            occupied: cell.occupied,
            occupantId: cell.occupantId,
            walkCost: cell.walkCost,
          }
        : {
            col: colIndex,
            row: rowIndex,
            type: "blocked",
            occupied: false,
            walkCost: 99,
          },
    ),
  );
}
