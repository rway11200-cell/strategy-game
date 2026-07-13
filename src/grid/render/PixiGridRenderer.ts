import { Container, Graphics } from "pixi.js";
import { type GridConfig, gridToWorld } from "../GridConfig";
import { type CellRenderData, type GridRenderAdapter } from "./GridRenderAdapter";

const CELL_COLORS: Record<string, number> = {
  walkable: 0x4caf50,
  blocked: 0xb71c1c,
  spawn: 0x7b1fa2,
  base: 0xf57c00,
  tower: 0x78909c,
  path: 0x42a5f5,
};

const CELL_ALPHA = 0.65;
const HIGHLIGHT_COLOR = 0xffffff;
const HIGHLIGHT_ALPHA = 0.4;
const PATH_COLOR = 0x00e5ff;
const PATH_ALPHA = 0.7;
const PATH_WIDTH = 3;

export class PixiGridRenderer implements GridRenderAdapter {
  private container: Container;
  private config: GridConfig;
  private cellGraphics: Graphics;
  private pathGraphics: Graphics;
  private highlightGraphics: Graphics;

  constructor(container: Container, config: GridConfig) {
    this.container = container;
    this.config = config;
    this.cellGraphics = new Graphics();
    this.pathGraphics = new Graphics();
    this.highlightGraphics = new Graphics();

    this.container.addChild(this.cellGraphics);
    this.container.addChild(this.pathGraphics);
    this.container.addChild(this.highlightGraphics);
  }

  render(cells: CellRenderData[][]): void {
    this.cellGraphics.clear();
    const { cellSize, offsetX, offsetY } = this.config;

    for (let row = 0; row < cells.length; row++) {
      const rowData = cells[row];
      if (!rowData) continue;
      for (let col = 0; col < rowData.length; col++) {
        const cell = rowData[col];
        if (!cell) continue;

        const color = CELL_COLORS[cell.type] ?? CELL_COLORS.walkable;
        const x = offsetX + col * cellSize;
        const y = offsetY + row * cellSize;

        this.cellGraphics.rect(x, y, cellSize, cellSize).fill({ color, alpha: CELL_ALPHA });
      }
    }
  }

  clear(): void {
    this.cellGraphics.clear();
    this.pathGraphics.clear();
    this.highlightGraphics.clear();
  }

  highlightPath(path: { col: number; row: number }[]): void {
    this.pathGraphics.clear();
    if (path.length === 0) return;

    const start = gridToWorld(path[0].col, path[0].row, this.config);
    this.pathGraphics.moveTo(start.x, start.y);

    for (let i = 1; i < path.length; i++) {
      const pt = gridToWorld(path[i].col, path[i].row, this.config);
      this.pathGraphics.lineTo(pt.x, pt.y);
    }

    this.pathGraphics.stroke({ width: PATH_WIDTH, color: PATH_COLOR, alpha: PATH_ALPHA });

    const end = gridToWorld(
      path[path.length - 1].col,
      path[path.length - 1].row,
      this.config,
    );
    this.highlightGraphics.circle(end.x, end.y, 6).fill({ color: PATH_COLOR, alpha: 1 });
  }

  clearPath(): void {
    this.pathGraphics.clear();
  }

  highlightCell(coord: { col: number; row: number }): void {
    this.highlightGraphics.clear();
    const { cellSize, offsetX, offsetY } = this.config;
    const x = offsetX + coord.col * cellSize;
    const y = offsetY + coord.row * cellSize;
    this.highlightGraphics
      .rect(x, y, cellSize, cellSize)
      .fill({ color: HIGHLIGHT_COLOR, alpha: HIGHLIGHT_ALPHA });
  }

  clearHighlights(): void {
    this.highlightGraphics.clear();
  }

  destroy(): void {
    this.clear();
    this.container.removeChild(this.cellGraphics);
    this.container.removeChild(this.pathGraphics);
    this.container.removeChild(this.highlightGraphics);
    this.cellGraphics.destroy();
    this.pathGraphics.destroy();
    this.highlightGraphics.destroy();
  }
}
