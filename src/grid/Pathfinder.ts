import { type CellCoord, type GridConfig } from "./GridConfig";
import { GridState } from "./GridState";
import {
  getEntityFootprint,
  getFootprintCellsForPos,
  isFootprintWalkable,
} from "./EntityFootprint";

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

function nodeKey(n: CellCoord): string {
  return `${n.col},${n.row}`;
}

export function findPath(
  start: CellCoord,
  end: CellCoord,
  gridState: GridState,
  ignoredOccupantId?: string,
): CellCoord[] {
  if (!gridState.isWalkable(start, ignoredOccupantId) || !gridState.isWalkable(end, ignoredOccupantId)) {
    return [];
  }

  const open: AStarNode[] = [];
  const closed = new Set<string>();

  const startNode: AStarNode = {
    col: start.col,
    row: start.row,
    g: 0,
    h: heuristic(start, end),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  open.push(startNode);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const key = nodeKey(current);

    if (current.col === end.col && current.row === end.row) {
      const path: CellCoord[] = [];
      let node: AStarNode | null = current;
      while (node) {
        path.unshift({ col: node.col, row: node.row });
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
      if (!gridState.isWalkable(neighbor, ignoredOccupantId)) continue;

      const g = current.g + cell.walkCost;
      const h = heuristic(neighbor, end);
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

export function findPathWithFootprint(
  start: CellCoord,
  end: CellCoord,
  gridState: GridState,
  config: GridConfig,
  entityType: string,
  ignoredOccupantId?: string,
  allowOccupiedEnd = false,
): CellCoord[] {
  const footprint = getEntityFootprint(entityType);

  if (
    !isFootprintWalkable(
      start,
      footprint.width,
      footprint.height,
      gridState,
      config,
      ignoredOccupantId,
    )
  ) {
    return [];
  }
  if (
    !allowOccupiedEnd &&
    !isFootprintWalkable(
      end,
      footprint.width,
      footprint.height,
      gridState,
      config,
      ignoredOccupantId,
    )
  ) {
    return [];
  }

  const open: AStarNode[] = [];
  const closed = new Set<string>();

  const startNode: AStarNode = {
    col: start.col,
    row: start.row,
    g: 0,
    h: heuristic(start, end),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  open.push(startNode);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const key = nodeKey(current);

    if (current.col === end.col && current.row === end.row) {
      const path: CellCoord[] = [];
      let node: AStarNode | null = current;
      while (node) {
        path.unshift({ col: node.col, row: node.row });
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
      const isEnd = neighbor.col === end.col && neighbor.row === end.row;
      if (
        !(isEnd && allowOccupiedEnd
          ? isFootprintTerrainWalkable(
              neighbor,
              footprint.width,
              footprint.height,
              gridState,
              config,
            )
          : isFootprintWalkable(
              neighbor,
              footprint.width,
              footprint.height,
              gridState,
              config,
              ignoredOccupantId,
            ))
      )
        continue;

      const cell = gridState.getCell(neighbor);
      if (!cell) continue;

      const g = current.g + cell.walkCost;
      const h = heuristic(neighbor, end);
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

function isFootprintTerrainWalkable(
  anchor: CellCoord,
  width: number,
  height: number,
  gridState: GridState,
  config: GridConfig,
): boolean {
  return getFootprintCellsForPos(anchor, width, height).every((coord) => {
    if (
      coord.col < 0 ||
      coord.col >= config.gridWidth ||
      coord.row < 0 ||
      coord.row >= config.gridHeight
    ) {
      return false;
    }
    return gridState.getCell(coord)?.type !== "blocked";
  });
}
