import { type Point } from "./GridConfig";

export interface PathCell {
  col: number;
  row: number;
}

export interface Footprint {
  cells: PathCell[];
}

export function pathToFootprint(points: Point[]): Footprint {
  return {
    cells: points.map((p) => ({ col: p.x, row: p.y })),
  };
}

export function footprintToPoints(footprint: Footprint): Point[] {
  return footprint.cells.map((c) => ({ x: c.col, y: c.row }));
}

export function isContiguous(footprint: Footprint): boolean {
  for (let i = 1; i < footprint.cells.length; i++) {
    const prev = footprint.cells[i - 1];
    const curr = footprint.cells[i];
    const dx = Math.abs(curr.col - prev.col);
    const dy = Math.abs(curr.row - prev.row);
    if (dx + dy !== 1) return false;
  }
  return true;
}
