import { Point } from "../core/grid/GridConfig";
import { type CellCoord } from "./GridConfig";
import { GridState } from "./GridState";

interface AStarNode {
  col: number;
  row: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

const DIRS: readonly [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

function heuristic(a: CellCoord, b: CellCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function coordFromPoint(p: Point): CellCoord {
  return { col: p.x, row: p.y };
}

function nodeKey(n: CellCoord): string {
  return `${n.col},${n.row}`;
}

export function findPath(
  start: Point,
  end: Point,
  gridState: GridState,
): Point[] {
  const startCoord = coordFromPoint(start);
  const endCoord = coordFromPoint(end);

  if (!gridState.isWalkable(startCoord) || !gridState.isWalkable(endCoord)) {
    return [];
  }

  const open: AStarNode[] = [];
  const closed = new Set<string>();

  const startNode: AStarNode = {
    col: startCoord.col,
    row: startCoord.row,
    g: 0,
    h: heuristic(startCoord, endCoord),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  open.push(startNode);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const key = nodeKey(current);

    if (current.col === endCoord.col && current.row === endCoord.row) {
      const path: Point[] = [];
      let node: AStarNode | null = current;
      while (node) {
        path.unshift({ x: node.col, y: node.row });
        node = node.parent;
      }
      path.shift();
      return path;
    }

    closed.add(key);

    for (const [dc, dr] of DIRS) {
      const neighbor: CellCoord = {
        col: current.col + dc,
        row: current.row + dr,
      };
      const nKey = nodeKey(neighbor);

      if (closed.has(nKey)) continue;

      const cell = gridState.getCell(neighbor);
      if (!cell) continue;
      if (!gridState.isWalkable(neighbor)) continue;

      const g = current.g + cell.walkCost;
      const h = heuristic(neighbor, endCoord);
      const f = g + h;

      const existing = open.find((n) => n.col === neighbor.col && n.row === neighbor.row);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
      } else {
        open.push({
          col: neighbor.col,
          row: neighbor.row,
          g,
          h,
          f,
          parent: current,
        });
      }
    }
  }

  return [];
}
