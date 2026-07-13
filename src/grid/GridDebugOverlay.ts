import { Container, Graphics } from "pixi.js";
import { type GridConfig, gridToWorld, type Point } from "./GridConfig";
import type { CellState } from "./GridState";

const CELL_COLORS: Record<string, number> = {
  walkable: 0x4caf50,
  blocked: 0xb71c1c,
  spawn: 0x7b1fa2,
  base: 0xf57c00,
  tower: 0x78909c,
  path: 0x42a5f5,
};

const CELL_ALPHA = 0.3;
const GRID_LINE_COLOR = 0xffffff;
const GRID_LINE_ALPHA = 0.15;
const PATH_COLOR = 0x00e5ff;
const PATH_ALPHA = 0.7;

export class GridDebugOverlay {
  private container: Container;
  private config: GridConfig;
  private devMode: boolean;
  private visible: boolean = false;
  private dirty: boolean = true;
  private cells: (CellState | null)[][] = [];
  private path: Point[] = [];
  private onKeyDown: EventListener;
  private onVisibilityChange: (() => void) | null = null;

  constructor(config: GridConfig, devMode: boolean, eventTarget?: EventTarget) {
    this.config = config;
    this.devMode = devMode;
    this.container = new Container();
    this.container.visible = false;

    this.container.eventMode = "none";

    this.onKeyDown = ((e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "g" || ke.key === "G") {
        this.toggle();
      }
    }) as EventListener;

    if (this.devMode) {
      const target = eventTarget ?? (typeof window !== "undefined" ? window : null);
      target?.addEventListener("keydown", this.onKeyDown);
    }
  }

  setCells(cells: (CellState | null)[][]): void {
    this.cells = cells;
    this.dirty = true;
  }

  setPath(path: Point[]): void {
    this.path = path;
    this.dirty = true;
  }

  toggle(): void {
    if (!this.devMode) return;
    this.visible = !this.visible;
    this.container.visible = this.visible;
    if (this.visible) {
      this.dirty = true;
    }
    this.onVisibilityChange?.();
  }

  isVisible(): boolean {
    return this.visible;
  }

  getContainer(): Container {
    return this.container;
  }

  destroy(eventTarget?: EventTarget): void {
    const target = eventTarget ?? (typeof window !== "undefined" ? window : null);
    target?.removeEventListener("keydown", this.onKeyDown);
    this.container.removeAllListeners();
    this.container.destroy({ children: true });
  }

  onToggle(callback: () => void): void {
    this.onVisibilityChange = callback;
  }

  render(): void {
    if (!this.dirty || !this.visible) return;
    this.dirty = false;

    this.container.removeChildren();

    this.drawCells();
    this.drawGridLines();
    this.drawPath();
  }

  private drawCells(): void {
    const { cellSize, offsetX, offsetY, gridWidth, gridHeight } = this.config;

    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const cell = this.cells[row]?.[col];
        if (!cell) continue;

        const color = CELL_COLORS[cell.type] ?? CELL_COLORS.walkable;
        const worldX = offsetX + col * cellSize;
        const worldY = offsetY + row * cellSize;

        const g = new Graphics()
          .rect(worldX, worldY, cellSize, cellSize)
          .fill({ color, alpha: CELL_ALPHA });
        this.container.addChild(g);
      }
    }
  }

  private drawGridLines(): void {
    const { cellSize, offsetX, offsetY, gridWidth, gridHeight } = this.config;
    const totalWidth = gridWidth * cellSize;
    const totalHeight = gridHeight * cellSize;

    const lines = new Graphics();

    for (let col = 0; col <= gridWidth; col++) {
      const x = offsetX + col * cellSize;
      lines.moveTo(x, offsetY);
      lines.lineTo(x, offsetY + totalHeight);
    }

    for (let row = 0; row <= gridHeight; row++) {
      const y = offsetY + row * cellSize;
      lines.moveTo(offsetX, y);
      lines.lineTo(offsetX + totalWidth, y);
    }

    lines.stroke({ width: 1, color: GRID_LINE_COLOR, alpha: GRID_LINE_ALPHA });
    this.container.addChild(lines);
  }

  private drawPath(): void {
    if (this.path.length === 0) return;

    const line = new Graphics();

    const start = gridToWorld(this.path[0].x, this.path[0].y, this.config);
    line.moveTo(start.x, start.y);

    for (let i = 1; i < this.path.length; i++) {
      const pt = gridToWorld(this.path[i].x, this.path[i].y, this.config);
      line.lineTo(pt.x, pt.y);
    }

    line.stroke({ width: 3, color: PATH_COLOR, alpha: PATH_ALPHA });
    this.container.addChild(line);

    const end = gridToWorld(
      this.path[this.path.length - 1].x,
      this.path[this.path.length - 1].y,
      this.config,
    );
    const endMarker = new Graphics()
      .circle(end.x, end.y, 6)
      .fill({ color: PATH_COLOR, alpha: 1 });
    this.container.addChild(endMarker);
  }
}
