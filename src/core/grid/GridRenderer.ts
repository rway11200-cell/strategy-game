import { Container, Graphics } from "pixi.js";
import { CellType, GridConfig, gridToWorld } from "./GridConfig";

/**
 * Runtime data for a single cell used as render input.
 * A 2D array of these cells (row-major) is passed to GridRenderer.
 */
export interface CellData {
  x: number;
  y: number;
  type: CellType;
  walkable: boolean;
  weight: number;
}

const CELL_COLORS: Record<CellType, number> = {
  walkable: 0x4caf50,
  blocked: 0xb71c1c,
  spawn: 0x7b1fa2,
  base: 0xf57c00,
  tower: 0x78909c,
};

const CELL_ALPHA = 0.65;
const HOVER_COLOR = 0xffffff;
const HOVER_ALPHA = 0.35;
const SELECTED_ALPHA = 0.55;

const OVERLAY_RADIUS = 4;

/** One rendered cell: the base graphic + hover/selection overlay. */
interface CellGraphic {
  base: Graphics;
  overlay: Graphics;
  row: number;
  col: number;
}

/**
 * Renders a grid of cells as Pixi Graphics.
 *
 * Each cell is two stacked Graphics:
 *  - base: filled rectangle in the cell's type color
 *  - overlay: transparent highlight shown on hover or selection
 *
 * Accepts a CellData[][] (row-major) and draws it into a Container.
 */
export class GridRenderer {
  private cells: CellGraphic[] = [];
  private selected: { row: number; col: number } | null = null;

  private container: Container | null = null;
  private config: GridConfig;

  constructor(config: GridConfig) {
    this.config = config;
  }

  private buildCellGraphic(row: number, col: number, type: CellType): CellGraphic {
    const { x, y } = gridToWorld(col, row, this.config);
    const size = this.config.cellSize;
    const half = size / 2;

    const color = CELL_COLORS[type];
    const base = new Graphics()
      .rect(x - half, y - half, size, size)
      .fill({ color, alpha: CELL_ALPHA });

    base.eventMode = "static";
    base.cursor = "pointer";

    const overlay = new Graphics()
      .roundRect(x - half + 2, y - half + 2, size - 4, size - 4, OVERLAY_RADIUS)
      .fill({ color: HOVER_COLOR, alpha: 0 });

    overlay.eventMode = "none";

    return { base, overlay, row, col };
  }

  private onPointerOver(cell: CellGraphic): void {
    this.updateOverlay(cell);
  }

  private onPointerOut(cell: CellGraphic): void {
    cell.overlay.alpha = 0;
  }

  private onPointerDown(cell: CellGraphic): void {
    if (this.selected?.row === cell.row && this.selected?.col === cell.col) {
      this.selected = null;
      cell.overlay.alpha = 0;
      return;
    }

    if (this.selected) {
      const prev = this.cells.find(
        (c) => c.row === this.selected!.row && c.col === this.selected!.col,
      );
      if (prev) prev.overlay.alpha = 0;
    }

    this.selected = { row: cell.row, col: cell.col };
    cell.overlay.alpha = SELECTED_ALPHA;
  }

  private updateOverlay(cell: CellGraphic): void {
    const isSelected =
      this.selected?.row === cell.row && this.selected?.col === cell.col;
    cell.overlay.alpha = isSelected ? SELECTED_ALPHA : HOVER_ALPHA;
  }

  /**
   * Draws (or redraws) the entire grid. Clears any previous graphics.
   *
   * @param gridData  Row-major 2D array of cell data (outer = rows, inner = columns).
   * @param container The Pixi Container to add all graphics into.
   */
  public render(gridData: CellData[][], container: Container): void {
    this.clear();
    this.container = container;
    this.selected = null;
    this.cells = [];

    for (let row = 0; row < gridData.length; row++) {
      const rowData = gridData[row];
      for (let col = 0; col < rowData.length; col++) {
        const cellData = rowData[col];
        const cell = this.buildCellGraphic(row, col, cellData.type);

        cell.base.on("pointerover", () => this.onPointerOver(cell));
        cell.base.on("pointerout", () => this.onPointerOut(cell));
        cell.base.on("pointerdown", () => this.onPointerDown(cell));

        container.addChild(cell.base);
        container.addChild(cell.overlay);

        this.cells.push(cell);
      }
    }
  }

  /** Removes all grid graphics from the container and clears internal state. */
  public clear(): void {
    if (!this.container) return;

    for (const cell of this.cells) {
      this.container.removeChild(cell.base);
      this.container.removeChild(cell.overlay);
      cell.base.destroy({ children: true });
      cell.overlay.destroy({ children: true });
    }

    this.cells = [];
    this.selected = null;
    this.container = null;
  }
}
