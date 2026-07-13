import { type CellCoord } from "../GridConfig";

export interface CellRenderData {
  col: number;
  row: number;
  type: string;
  occupied: boolean;
  occupantId?: string;
  walkCost: number;
}

export interface GridRenderAdapter {
  render(cells: CellRenderData[][]): void;
  clear(): void;
  highlightPath(path: CellCoord[]): void;
  clearPath(): void;
  highlightCell(coord: CellCoord): void;
  clearHighlights(): void;
  destroy(): void;
}
