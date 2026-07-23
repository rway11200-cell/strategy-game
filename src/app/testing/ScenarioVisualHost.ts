import { Container, Graphics } from "pixi.js";
import { gridToWorld, type GridConfig } from "../../grid/GridConfig";
import type { GridState } from "../../grid/GridState";
import { AttackCommand, AttackMoveCommand, MoveCommand, PatrolCommand } from "../core/UnitCommands";
import { Unit } from "../core/unidades/Unit";

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
const STRUCTURE_COLOR = 0x1565c0;
const MOVE_DESTINATION_COLOR = 0x66bb6a;
const ATTACK_DESTINATION_COLOR = 0xef5350;

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
  private markerLayer: Container | null = null;
  private gridConfig: GridConfig | null = null;
  private selectedUnit?: Unit;
  private destinationMarker?: Graphics;
  private finalDestinationMarker?: Graphics;

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
    this.markerLayer = new Container();
    this.markerLayer.label = "selection-markers";
    this.destinationMarker = new Graphics();
    this.finalDestinationMarker = new Graphics();
    this.markerLayer.addChild(this.finalDestinationMarker);
    this.markerLayer.addChild(this.destinationMarker);

    this.root.addChild(this.gridLayer);
    this.root.addChild(this.unitLayer);
    this.root.addChild(this.markerLayer);
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
    this.selectedUnit?.setSelected(false);
    if (this.root) {
      this.stage.removeChild(this.root);
      this.root.destroy({ children: true });
      this.root = null;
    }
    this.gridLayer = null;
    this.unitLayer = null;
    this.markerLayer = null;
    this.gridConfig = null;
    this.destinationMarker = undefined;
    this.finalDestinationMarker = undefined;
    this.selectedUnit = undefined;
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
        const color = cell?.occupantId?.startsWith("structure:")
          ? STRUCTURE_COLOR
          : (CELL_COLORS[cell?.type ?? "walkable"] ?? CELL_COLORS.walkable);
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
    this.updateDestinationMarker();
    this.ctx.renderNow();
  }

  public registerUnit(unit: Unit): void {
    unit.setSelectionHandler(this.selectUnit);
  }

  public refreshSelection(): void {
    this.updateDestinationMarker();
    this.ctx.renderNow();
  }

  private selectUnit = (unit: Unit): void => {
    if (this.selectedUnit === unit) return;
    this.selectedUnit?.setSelected(false);
    this.selectedUnit = unit;
    unit.setSelected(true);
    this.refreshSelection();
  };

  private updateDestinationMarker(): void {
    const nextMarker = this.destinationMarker;
    const finalMarker = this.finalDestinationMarker;
    if (!nextMarker || !finalMarker) return;
    nextMarker.clear();
    finalMarker.clear();
    const unit = this.selectedUnit;
    const gridConfig = this.gridConfig;
    if (!unit?.active || !gridConfig) return;

    const targetCell = unit.getCommandMovementState().targetCell;
    const finalDestination = this.getFinalDestination(unit, gridConfig);
    const attacking = unit.activity === "pursuing" ||
      unit.activity === "attacking" ||
      unit.currentCommand?.type === "attack";
    const color = attacking ? ATTACK_DESTINATION_COLOR : MOVE_DESTINATION_COLOR;

    if (finalDestination) {
      const destination = gridToWorld(finalDestination.col, finalDestination.row, gridConfig);
      const radius = Math.max(14, gridConfig.cellSize * 0.36);
      finalMarker.poly([
        destination.x, destination.y - radius,
        destination.x + radius, destination.y,
        destination.x, destination.y + radius,
        destination.x - radius, destination.y,
      ]).fill({ color, alpha: 0.24 }).stroke({ color, width: 3, alpha: 0.95 });
    }

    if (!targetCell) return;
    const destination = gridToWorld(targetCell.col, targetCell.row, gridConfig);
    const radius = Math.max(10, gridConfig.cellSize * 0.28);
    nextMarker.circle(destination.x, destination.y, radius).stroke({ color, width: 3, alpha: 0.95 });
    nextMarker.moveTo(destination.x - radius, destination.y);
    nextMarker.lineTo(destination.x + radius, destination.y);
    nextMarker.moveTo(destination.x, destination.y - radius);
    nextMarker.lineTo(destination.x, destination.y + radius);
    nextMarker.stroke({ color, width: 2, alpha: 0.8 });
  }

  private getFinalDestination(unit: Unit, gridConfig: GridConfig): { col: number; row: number } | undefined {
    const command = unit.currentCommand;
    if (command instanceof MoveCommand) {
      return command.getResolvedDestination() ?? command.destination;
    }
    if (command instanceof AttackCommand) {
      return command.target.getGridCell(gridConfig);
    }
    if (command instanceof AttackMoveCommand) {
      return command.getPursuitTarget()?.getGridCell(gridConfig) ?? command.getDestination();
    }
    if (command instanceof PatrolCommand) return command.getDestination();
  }
}
