import { Container, Graphics } from "pixi.js";
import type { GridConfig } from "../../grid/GridConfig";
import type { GridState } from "../../grid/GridState";

const CELL_COLORS: Record<string, number> = {
  walkable: 0x4caf50,
  blocked: 0xb71c1c,
  spawn: 0x7b1fa2,
  base: 0xf57c00,
  tower: 0x78909c,
  path: 0x42a5f5,
};

const GRID_LINE_COLOR = 0xffffff;
const GRID_LINE_ALPHA = 0.2;

export interface VisualHostContext {
  renderNow(): void;
  getContainerWidth(): number;
  getContainerHeight(): number;
}

export class ScenarioVisualHost {
  private readonly stage: Container;
  private readonly ctx: VisualHostContext;
  private root: Container | null = null;
  private gridLayer: Container | null = null;
  private unitLayer: Container | null = null;
  private gridConfig: GridConfig | null = null;

  constructor(stage: Container, ctx: VisualHostContext) {
    this.stage = stage;
    this.ctx = ctx;
  }

  mount(gridConfig: GridConfig, unitContainer: Container): void {
    this.gridConfig = gridConfig;
    this.root = new Container();
    this.root.label = "scenario-root";
    this.gridLayer = new Container();
    this.gridLayer.label = "grid";
    this.unitLayer = unitContainer;

    this.root.addChild(this.gridLayer);
    this.root.addChild(this.unitLayer);
    this.stage.addChild(this.root);

    this.recenter();
    this.ctx.renderNow();
  }

  recenter(): void {
    if (!this.root || !this.gridConfig) return;
    const pw = this.ctx.getContainerWidth();
    const ph = this.ctx.getContainerHeight();
    const gw = this.gridConfig.gridWidth * this.gridConfig.cellSize;
    const gh = this.gridConfig.gridHeight * this.gridConfig.cellSize;
    this.root.position.set(Math.max(0, (pw - gw) / 2), Math.max(0, (ph - gh) / 2));
  }

  unmount(): void {
    if (this.root) {
      this.stage.removeChild(this.root);
      this.root.destroy({ children: true });
      this.root = null;
    }
    this.gridLayer = null;
    this.unitLayer = null;
    this.gridConfig = null;
    this.ctx.renderNow();
  }

  updateGrid(gridState: GridState): void {
    if (!this.gridLayer || !this.gridConfig) return;

    this.gridLayer.removeChildren();
    const g = new Graphics();
    const config = this.gridConfig;

    for (let row = 0; row < config.gridHeight; row++) {
      for (let col = 0; col < config.gridWidth; col++) {
        const cell = gridState.getCell({ col, row });
        const x = col * config.cellSize;
        const y = row * config.cellSize;
        const color = CELL_COLORS[cell?.type ?? "walkable"] ?? CELL_COLORS.walkable;
        g.rect(x, y, config.cellSize, config.cellSize).fill({ color, alpha: 0.3 });
      }
    }

    for (let c = 0; c <= config.gridWidth; c++) {
      const x = c * config.cellSize;
      g.moveTo(x, 0);
      g.lineTo(x, config.gridHeight * config.cellSize);
    }
    for (let r = 0; r <= config.gridHeight; r++) {
      const y = r * config.cellSize;
      g.moveTo(0, y);
      g.lineTo(config.gridWidth * config.cellSize, y);
    }
    g.stroke({ width: 1, color: GRID_LINE_COLOR, alpha: GRID_LINE_ALPHA });

    this.gridLayer.addChild(g);
    this.ctx.renderNow();
  }
}
