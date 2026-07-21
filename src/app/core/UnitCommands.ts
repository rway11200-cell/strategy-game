import type { Ticker } from "pixi.js";
import type { CellCoord, GridConfig } from "../../grid/GridConfig";
import type { GridState } from "../../grid/GridState";
import { findPathWithFootprint } from "../../grid/Pathfinder";
import { isFootprintWalkable } from "../../grid/EntityFootprint";
import type { TileWalkResult } from "./TileMovement";
import type { Unit } from "./unidades/Unit";

export type UnitCommandType = "move" | "attack" | "stop" | "patrol" | "hold";
export type CommandStatus = "running" | "completed" | "failed";

export interface CommandPathfinder {
  findPath(
    start: CellCoord,
    end: CellCoord,
    gridState: GridState,
    gridConfig: GridConfig,
    entityType: string,
    ignoredOccupantId: string,
  ): CellCoord[];
}

export interface CommandContext {
  gridConfig: GridConfig;
  gridState: GridState;
  pathfinder: CommandPathfinder;
  enemies: Unit[];
  entityType: string;
  occupantId: string;
}

export interface IUnitCommand {
  readonly type: UnitCommandType;
  readonly status: CommandStatus;
  execute(unit: Unit, context: CommandContext): void;
  update(unit: Unit, context: CommandContext, ticker: Ticker): CommandStatus;
  cancel(unit: Unit): void;
}

export const defaultCommandPathfinder: CommandPathfinder = {
  findPath(start, end, gridState, gridConfig, entityType, ignoredOccupantId) {
    return findPathWithFootprint(
      start,
      end,
      gridState,
      gridConfig,
      entityType,
      ignoredOccupantId,
      true,
    );
  },
};

abstract class BaseCommand implements IUnitCommand {
  abstract readonly type: UnitCommandType;
  status: CommandStatus = "running";

  abstract execute(unit: Unit, context: CommandContext): void;
  abstract update(unit: Unit, context: CommandContext, ticker: Ticker): CommandStatus;

  cancel(unit: Unit): void {
    unit.clearCommandMovement();
    unit.setCommandShooting("auto");
    this.status = "completed";
  }

  protected pathTo(
    unit: Unit,
    context: CommandContext,
    destination: CellCoord,
    loop = false,
  ): boolean {
    const start = unit.getGridCell(context.gridConfig);
    if (!start) return false;
    if (sameCell(start, destination)) {
      unit.clearCommandMovement();
      return true;
    }

    const path = context.pathfinder.findPath(
      start,
      destination,
      context.gridState,
      context.gridConfig,
      context.entityType,
      context.occupantId,
    );
    if (path.length === 0) return false;
    unit.setCommandCellRoute(path, loop);
    return true;
  }
}

export class MoveCommand extends BaseCommand {
  readonly type = "move" as const;

  static readonly MAX_FRAMES_WITHOUT_PROGRESS = 300;
  private framesWithoutProgress = 0;
  private bestDistance = Infinity;

  constructor(public readonly destination: CellCoord) {
    super();
  }

  execute(unit: Unit, context: CommandContext): void {
    this.framesWithoutProgress = 0;
    this.bestDistance = Infinity;
    this.status = "running";
    unit.setCommandShooting("auto");
    const current = unit.getGridCell(context.gridConfig);
    if (current && sameCell(current, this.destination)) {
      unit.clearCommandMovement();
      this.status = "completed";
      return;
    }
    unit.clearCommandMovement();
    this.pathTo(unit, context, this.destination);
  }

  update(unit: Unit, context: CommandContext, ticker: Ticker): CommandStatus {
    if (this.status !== "running") return this.status;

    const movement = unit.updateCommandMovement(ticker);
    const current = unit.getGridCell(context.gridConfig);

    if (current && sameCell(current, this.destination)) {
      unit.clearCommandMovement();
      this.status = "completed";
      return this.status;
    }

    if (current) {
      const distance = cellDistance(current, this.destination);
      if (distance < this.bestDistance) {
        this.bestDistance = distance;
        this.framesWithoutProgress = 0;
      }
    }

    this.framesWithoutProgress++;
    if (this.framesWithoutProgress >= MoveCommand.MAX_FRAMES_WITHOUT_PROGRESS) {
      unit.clearCommandMovement();
      this.status = "completed";
      return this.status;
    }

    if (movement.blocked || unit.isCommandMovementFinished()) {
      this.pathTo(unit, context, this.destination);
    }

    return this.status;
  }

  protected pathTo(unit: Unit, context: CommandContext, destination: CellCoord): boolean {
    const start = unit.getGridCell(context.gridConfig);
    if (!start) return false;

    if (sameCell(start, destination)) {
      unit.clearCommandMovement();
      return true;
    }

    const path = context.pathfinder.findPath(
      start,
      destination,
      context.gridState,
      context.gridConfig,
      context.entityType,
      context.occupantId,
    );
    if (path.length > 0) {
      unit.setCommandCellRoute(path);
      return true;
    }

    const fallback = this.findBestFallback(start, context);
    if (fallback && !sameCell(start, fallback)) {
      const fallbackPath = context.pathfinder.findPath(
        start,
        fallback,
        context.gridState,
        context.gridConfig,
        context.entityType,
        context.occupantId,
      );
      if (fallbackPath.length > 0) {
        unit.setCommandCellRoute(fallbackPath);
        return true;
      }
    }

    return false;
  }

  private findBestFallback(start: CellCoord, context: CommandContext): CellCoord | null {
    const { gridState, gridConfig, occupantId, entityType } = context;
    const visited = new Set<string>();
    const queue: CellCoord[] = [this.destination];
    visited.add(`${this.destination.col},${this.destination.row}`);

    while (queue.length > 0) {
      const cell = queue.shift()!;
      if (Math.abs(cell.col - this.destination.col) > 6 || Math.abs(cell.row - this.destination.row) > 6) continue;

      if (isFootprintWalkable(cell, 1, 1, gridState, gridConfig, occupantId)) {
        const path = findPathWithFootprint(start, cell, gridState, gridConfig, entityType, occupantId);
        if (path.length > 0) return cell;
      }

      for (const [dc, dr] of [
        [0, -1], [0, 1], [-1, 0], [1, 0],
        [-1, -1], [-1, 1], [1, -1], [1, 1],
      ]) {
        const next: CellCoord = { col: cell.col + dc, row: cell.row + dr };
        const key = `${next.col},${next.row}`;
        if (
          !visited.has(key) &&
          next.col >= 0 && next.col < gridConfig.gridWidth &&
          next.row >= 0 && next.row < gridConfig.gridHeight
        ) {
          visited.add(key);
          queue.push(next);
        }
      }
    }
    return null;
  }
}

export class AttackCommand extends BaseCommand {
  readonly type = "attack" as const;
  private lastTargetCell?: CellCoord;

  constructor(public readonly target: Unit) {
    super();
  }

  execute(unit: Unit, context: CommandContext): void {
    this.status = "running";
    this.lastTargetCell = undefined;
    if (!this.target.active || !this.target.canBeProjectileTarget || unit.getShootingRange() === undefined) {
      this.status = "failed";
      return;
    }
    unit.setCommandShooting("forced", this.target);
    this.updateRoute(unit, context);
  }

  update(unit: Unit, context: CommandContext, ticker: Ticker): CommandStatus {
    if (this.status !== "running") return this.status;
    if (!this.target.active || !this.target.canBeProjectileTarget) {
      unit.clearCommandMovement();
      unit.setCommandShooting("disabled");
      this.status = "completed";
      return this.status;
    }

    const targetCell = this.target.getGridCell(context.gridConfig);
    const unitCell = unit.getGridCell(context.gridConfig);
    if (!targetCell || !unitCell) {
      this.status = "failed";
      return this.status;
    }

    if (isInRange(unitCell, targetCell, unit.getShootingRange() ?? 0)) {
      unit.clearCommandMovement();
      this.lastTargetCell = { ...targetCell };
      return "running";
    }

    if (!this.lastTargetCell || !sameCell(this.lastTargetCell, targetCell)) {
      this.updateRoute(unit, context);
    }

    const movement = unit.updateCommandMovement(ticker);
    if (movement.blocked || unit.isCommandMovementFinished()) {
      this.updateRoute(unit, context);
    }
    return "running";
  }

  private updateRoute(unit: Unit, context: CommandContext): void {
    const start = unit.getGridCell(context.gridConfig);
    const targetCell = this.target.getGridCell(context.gridConfig);
    const range = unit.getShootingRange();
    if (!start || !targetCell || range === undefined) return;

    this.lastTargetCell = { ...targetCell };
    if (isInRange(start, targetCell, range)) {
      unit.clearCommandMovement();
      return;
    }

    let bestPath: CellCoord[] | undefined;
    for (let row = 0; row < context.gridConfig.gridHeight; row++) {
      for (let col = 0; col < context.gridConfig.gridWidth; col++) {
        const destination = { col, row };
        if (!isInRange(destination, targetCell, range)) continue;
        const path = context.pathfinder.findPath(
          start,
          destination,
          context.gridState,
          context.gridConfig,
          context.entityType,
          context.occupantId,
        );
        if (path.length > 0 && (!bestPath || path.length < bestPath.length)) bestPath = path;
      }
    }

    if (bestPath) unit.setCommandCellRoute(bestPath);
    else unit.clearCommandMovement();
  }
}

export class StopCommand extends BaseCommand {
  readonly type = "stop" as const;

  execute(unit: Unit, _context: CommandContext): void {
    this.status = "running";
    unit.clearCommandMovement();
    unit.setCommandShooting("disabled");
    this.status = "completed";
  }

  update(_unit: Unit, _context: CommandContext, _ticker: Ticker): CommandStatus {
    return this.status;
  }

  cancel(unit: Unit): void {
    unit.clearCommandMovement();
    this.status = "completed";
  }
}

export class PatrolCommand extends BaseCommand {
  readonly type = "patrol" as const;
  private approachingStart = false;
  private destination?: CellCoord;

  constructor(public readonly cells: CellCoord[]) {
    super();
  }

  execute(unit: Unit, context: CommandContext): void {
    this.status = "running";
    this.approachingStart = false;
    unit.setCommandShooting("auto");
    if (this.cells.length !== 2) {
      this.status = "failed";
      return;
    }

    const current = unit.getGridCell(context.gridConfig);
    if (!current) {
      this.status = "failed";
      return;
    }
    if (!sameCell(current, this.cells[0])) {
      this.approachingStart = true;
      this.destination = this.cells[0];
      if (!this.pathTo(unit, context, this.destination)) this.status = "failed";
      return;
    }
    this.destination = this.cells[1];
    if (!this.pathTo(unit, context, this.destination)) this.status = "failed";
  }

  update(unit: Unit, context: CommandContext, ticker: Ticker): CommandStatus {
    if (this.status !== "running") return this.status;
    const movement = unit.updateCommandMovement(ticker);
    if (movement.blocked) {
      if (this.destination) this.pathTo(unit, context, this.destination);
      return "running";
    }
    if (!unit.isCommandMovementFinished()) return "running";

    const current = unit.getGridCell(context.gridConfig);
    if (!current || !this.destination || !sameCell(current, this.destination)) {
      if (this.destination) this.pathTo(unit, context, this.destination);
      return "running";
    }

    if (this.approachingStart) {
      this.approachingStart = false;
      this.destination = this.cells[1];
    } else if (this.destination && sameCell(this.destination, this.cells[1])) {
      this.destination = this.cells[0];
    } else {
      this.destination = this.cells[1];
    }
    this.pathTo(unit, context, this.destination);
    return "running";
  }
}

export class HoldPositionCommand extends BaseCommand {
  readonly type = "hold" as const;

  execute(unit: Unit, _context: CommandContext): void {
    this.status = "running";
    unit.clearCommandMovement();
    unit.setCommandShooting("auto");
  }

  update(_unit: Unit, _context: CommandContext, _ticker: Ticker): CommandStatus {
    return "running";
  }
}

function sameCell(a: CellCoord, b: CellCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

function cellDistance(a: CellCoord, b: CellCoord): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

function isInRange(a: CellCoord, b: CellCoord, range: number): boolean {
  return Math.hypot(a.col - b.col, a.row - b.row) <= range;
}

export type CommandMovementResult = TileWalkResult;
