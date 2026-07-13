import { Container, FederatedPointerEvent, Graphics } from "pixi.js";
import { type GridConfig, worldToGrid } from "./GridConfig";

/** Grid-cell coordinate (column, row). */
export interface CellCoord {
  col: number;
  row: number;
}

export type CellEventHandler = (coord: CellCoord) => void;

export interface CellEventCallbacks {
  onClick?: CellEventHandler;
  onHover?: CellEventHandler;
  onEnter?: CellEventHandler;
  onLeave?: CellEventHandler;
}

function coordsEqual(a: CellCoord, b: CellCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

function isInsideGrid(coord: CellCoord, config: GridConfig): boolean {
  return (
    coord.col >= 0 &&
    coord.col < config.gridWidth &&
    coord.row >= 0 &&
    coord.row < config.gridHeight
  );
}

/**
 * Translates a pointer event's global position to a grid cell and routes it to the
 * appropriate callback (onClick, onEnter, onLeave, onHover).
 * Extracted as a standalone function so it can be tested without relying on PixiJS
 * event dispatching internals.
 */
export interface CellEventRouter {
  handlePointerDown(x: number, y: number): void;
  handlePointerMove(x: number, y: number): void;
}

export class CellEvents {
  private overlay: Graphics;
  private callbacks: CellEventCallbacks;
  private config: GridConfig;
  private currentCell: CellCoord | null = null;

  readonly router: CellEventRouter = {
    handlePointerDown: (x: number, y: number): void => {
      const p = worldToGrid(x, y, this.config);
      const coord: CellCoord = { col: p.x, row: p.y };
      if (!isInsideGrid(coord, this.config)) return;
      this.callbacks.onClick?.(coord);
    },
    handlePointerMove: (x: number, y: number): void => {
      const p = worldToGrid(x, y, this.config);
      const coord: CellCoord = { col: p.x, row: p.y };

      if (!isInsideGrid(coord, this.config)) {
        if (this.currentCell !== null) {
          this.callbacks.onLeave?.(this.currentCell);
          this.currentCell = null;
        }
        return;
      }

      if (this.currentCell === null) {
        this.currentCell = coord;
        this.callbacks.onEnter?.(coord);
      } else if (!coordsEqual(this.currentCell, coord)) {
        this.callbacks.onLeave?.(this.currentCell);
        this.currentCell = coord;
        this.callbacks.onEnter?.(coord);
      }

      this.callbacks.onHover?.(coord);
    },
  };

  constructor(config: GridConfig, callbacks: CellEventCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;

    const totalWidth = config.gridWidth * config.cellSize;
    const totalHeight = config.gridHeight * config.cellSize;

    this.overlay = new Graphics()
      .rect(config.offsetX, config.offsetY, totalWidth, totalHeight)
      .fill({ color: 0xffffff, alpha: 0 });

    this.overlay.eventMode = "static";
    this.overlay.cursor = "pointer";
  }

  attach(container: Container): void {
    container.addChild(this.overlay);

    this.overlay.on("pointerdown", (event: FederatedPointerEvent) => {
      this.router.handlePointerDown(event.global.x, event.global.y);
    });

    this.overlay.on("globalpointermove", (event: FederatedPointerEvent) => {
      this.router.handlePointerMove(event.global.x, event.global.y);
    });
  }

  detach(): void {
    this.overlay.removeAllListeners();
    if (this.overlay.parent) {
      this.overlay.parent.removeChild(this.overlay);
    }
    this.currentCell = null;
  }

  getOverlay(): Graphics {
    return this.overlay;
  }
}
