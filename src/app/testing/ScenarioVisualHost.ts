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

export class ScenarioVisualHost {
  private readonly stage: Container;
  private gridLayer: Container | null = null;
  private unitLayer: Container | null = null;
  private gridConfig: GridConfig | null = null;

  constructor(stage: Container) {
    this.stage = stage;
  }

  mount(gridConfig: GridConfig, unitContainer: Container): void {
    this.gridConfig = gridConfig;
    this.gridLayer = new Container();
    this.unitLayer = unitContainer;

    this.stage.addChild(this.gridLayer);
    this.stage.addChild(this.unitLayer);
  }

  unmount(): void {
    if (this.gridLayer) {
      this.stage.removeChild(this.gridLayer);
      this.gridLayer.destroy({ children: true });
      this.gridLayer = null;
    }
    if (this.unitLayer) {
      this.stage.removeChild(this.unitLayer);
      this.unitLayer = null;
    }
    this.gridConfig = null;
  }

  updateGrid(gridState: GridState): void {
    if (!this.gridLayer || !this.gridConfig) return;

    this.gridLayer.removeChildren();
    const g = new Graphics();
    const config = this.gridConfig;

    for (let row = 0; row < config.gridHeight; row++) {
      for (let col = 0; col < config.gridWidth; col++) {
        const cell = gridState.getCell({ col, row });
        const x = config.offsetX + col * config.cellSize;
        const y = config.offsetY + row * config.cellSize;
        const color = CELL_COLORS[cell?.type ?? "walkable"] ?? CELL_COLORS.walkable;
        g.rect(x, y, config.cellSize, config.cellSize).fill({ color, alpha: 0.3 });
      }
    }

    for (let c = 0; c <= config.gridWidth; c++) {
      const x = config.offsetX + c * config.cellSize;
      g.moveTo(x, config.offsetY);
      g.lineTo(x, config.offsetY + config.gridHeight * config.cellSize);
    }
    for (let r = 0; r <= config.gridHeight; r++) {
      const y = config.offsetY + r * config.cellSize;
      g.moveTo(config.offsetX, y);
      g.lineTo(config.offsetX + config.gridWidth * config.cellSize, y);
    }
    g.stroke({ width: 1, color: GRID_LINE_COLOR, alpha: GRID_LINE_ALPHA });

    this.gridLayer.addChild(g);
  }
}
