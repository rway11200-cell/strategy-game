import type { Ticker } from "pixi.js";
import type { CellCoord, GridConfig } from "../../grid/GridConfig";
import type { GridState } from "../../grid/GridState";
import { findPathWithFootprint } from "../../grid/Pathfinder";
import { isFootprintWalkable } from "../../grid/EntityFootprint";
import type { TileWalkResult } from "./TileMovement";
import type { Unit } from "./unidades/Unit";

export type UnitCommandType = "move" | "attack" | "attack-move" | "stop" | "patrol" | "hold";
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

export type MoveCompletionReason = "destination-reached" | "fallback-reached" | "blocked";

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

  static readonly MAX_FRAMES_WITHOUT_PROGRESS = 30;
  static readonly MAX_FRAMES_WITHOUT_PROGRESS_ENEMY_BLOCK = 20;
  static readonly MAX_FRAMES_WITHOUT_PROGRESS_ALLY_BLOCK = 300;
  private framesWithoutProgress = 0;
  private bestDistance = Infinity;
  private resolvedDestination?: CellCoord;
  private completionReason?: MoveCompletionReason;

  constructor(public readonly destination: CellCoord) {
    super();
  }

  execute(unit: Unit, context: CommandContext): void {
    this.framesWithoutProgress = 0;
    this.bestDistance = Infinity;
    this.resolvedDestination = undefined;
    this.completionReason = undefined;
    this.status = "running";
    unit.setCommandShooting("auto");
    unit.setActivity("moving");
    const current = unit.getGridCell(context.gridConfig);
    if (current && sameCell(current, this.destination)) {
      unit.clearCommandMovement();
      this.resolvedDestination = { ...this.destination };
      this.completionReason = "destination-reached";
      this.status = "completed";
      return;
    }
    unit.clearCommandMovement();
    this.pathTo(unit, context);
  }

  update(unit: Unit, context: CommandContext, ticker: Ticker): CommandStatus {
    if (this.status !== "running") return this.status;

    const movement = unit.updateCommandMovement(ticker);
    const current = unit.getGridCell(context.gridConfig);

    const target = this.resolvedDestination ?? this.destination;
    if (current && sameCell(current, target)) {
      unit.clearCommandMovement();
      this.completionReason ??= sameCell(target, this.destination)
        ? "destination-reached"
        : "fallback-reached";
      this.status = "completed";
      return this.status;
    }

    if (current) {
      const distance = cellDistance(current, target);
      if (distance < this.bestDistance) {
        this.bestDistance = distance;
        this.framesWithoutProgress = 0;
      }
    }

    this.framesWithoutProgress++;
    const stepInProgress = unit.getCommandMovementState().stepProgress > 0;
    if (
      !stepInProgress &&
      this.framesWithoutProgress >= this.resolveMaxFramesWithoutProgress(unit, context)
    ) {
      this.completeBlocked(unit);
      return this.status;
    }

    if (movement.blocked || unit.isCommandMovementFinished()) {
      this.pathTo(unit, context);
    }

    return this.status;
  }

  getResolvedDestination(): CellCoord | undefined {
    return this.resolvedDestination && { ...this.resolvedDestination };
  }

  getCompletionReason(): MoveCompletionReason | undefined {
    return this.completionReason;
  }

  private completeBlocked(unit: Unit): void {
    unit.freezeMovement();
    this.completionReason ??= "blocked";
    this.status = "completed";
  }

  private resolveMaxFramesWithoutProgress(unit: Unit, context: CommandContext): number {
    const targetCell = unit.getCommandMovementState().targetCell;
    if (targetCell) {
      const cell = context.gridState.getCell(targetCell);
      const claimedBy = cell?.occupantId ?? cell?.reservedBy;
      const isBlocked = cell?.occupied || (cell?.reservedBy && cell.reservedBy !== unit.getId());
      if (isBlocked && cell.type !== "blocked" && claimedBy) {
        const blockedByEnemy = context.enemies.some((e) => e.getId() === claimedBy);
        return blockedByEnemy
          ? MoveCommand.MAX_FRAMES_WITHOUT_PROGRESS_ENEMY_BLOCK
          : MoveCommand.MAX_FRAMES_WITHOUT_PROGRESS_ALLY_BLOCK;
      }
      return MoveCommand.MAX_FRAMES_WITHOUT_PROGRESS;
    }

    const unitCell = unit.getGridCell(context.gridConfig);
    if (!unitCell) return MoveCommand.MAX_FRAMES_WITHOUT_PROGRESS;
    for (const [dc, dr] of [
      [0, -1], [0, 1], [-1, 0], [1, 0],
      [-1, -1], [-1, 1], [1, -1], [1, 1],
    ]) {
      const cell = context.gridState.getCell({ col: unitCell.col + dc, row: unitCell.row + dr });
      const claimedBy = cell?.occupantId ?? cell?.reservedBy;
      const isBlocked = cell?.occupied || (cell?.reservedBy && cell.reservedBy !== unit.getId());
      if (isBlocked && cell.type !== "blocked" && claimedBy) {
        const blockedByEnemy = context.enemies.some((e) => e.getId() === claimedBy);
        if (!blockedByEnemy) return MoveCommand.MAX_FRAMES_WITHOUT_PROGRESS_ALLY_BLOCK;
      }
    }
    return MoveCommand.MAX_FRAMES_WITHOUT_PROGRESS;
  }

  protected pathTo(unit: Unit, context: CommandContext): boolean {
    const start = unit.getGridCell(context.gridConfig);
    if (!start) return false;
    const destination = this.resolvedDestination ?? this.destination;

    if (sameCell(start, destination)) {
      unit.clearCommandMovement();
      return true;
    }

    // A blocked terrain destination cannot be occupied, so select a reachable
    // adjacent fallback rather than repeatedly routing into the obstacle.
    if (context.gridState.getCell(destination)?.type !== "blocked") {
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
    }

    if (this.resolvedDestination) return false;

    const fallback = this.findBestFallbackPath(start, context);
    if (fallback) {
      this.resolvedDestination = fallback.destination;
      this.completionReason = "fallback-reached";
      unit.setCommandCellRoute(fallback.path);
      return true;
    }

    return false;
  }

  private findBestFallbackPath(
    start: CellCoord,
    context: CommandContext,
  ): { destination: CellCoord; path: CellCoord[] } | undefined {
    const { gridState, gridConfig, occupantId, entityType } = context;
    const visited = new Set<string>();
    const queue: CellCoord[] = [this.destination];
    visited.add(`${this.destination.col},${this.destination.row}`);

    while (queue.length > 0) {
      const cell = queue.shift()!;
      if (Math.abs(cell.col - this.destination.col) > 6 || Math.abs(cell.row - this.destination.row) > 6) continue;

      if (isFootprintWalkable(cell, 1, 1, gridState, gridConfig, occupantId)) {
        const path = context.pathfinder.findPath(
          start,
          cell,
          gridState,
          gridConfig,
          entityType,
          occupantId,
        );
        let previousDistance = cellDistance(start, this.destination);
        const keepsApproaching = path.every((pathCell) => {
          const distance = cellDistance(pathCell, this.destination);
          if (distance > previousDistance) return false;
          previousDistance = distance;
          return true;
        });
        if (path.length > 0 && keepsApproaching) return { destination: cell, path };
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
    return undefined;
  }
}

export class AttackCommand extends BaseCommand {
  readonly type = "attack" as const;

  constructor(public readonly target: Unit) {
    super();
  }

  execute(unit: Unit, context: CommandContext): void {
    this.status = "running";
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
      unit.setActivity("attacking");
      return "running";
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
    unit.setActivity(bestPath ? "pursuing" : "blocked");
  }
}

export class AttackMoveCommand extends BaseCommand {
  readonly type = "attack-move" as const;
  private readonly march: MoveCommand;
  private pursuit?: AttackCommand;

  constructor(destination: CellCoord) {
    super();
    this.march = new MoveCommand(destination);
  }

  execute(unit: Unit, context: CommandContext): void {
    this.status = "running";
    this.pursuit = undefined;
    this.march.execute(unit, context);
  }

  update(unit: Unit, context: CommandContext, ticker: Ticker): CommandStatus {
    if (this.status !== "running") return this.status;

    const target = this.findVisibleTarget(unit, context);
    if (target) {
      if (this.pursuit?.target !== target) {
        this.pursuit = new AttackCommand(target);
        this.pursuit.execute(unit, context);
      }
      this.pursuit.update(unit, context, ticker);
      return this.status;
    }

    if (this.pursuit) {
      this.pursuit.cancel(unit);
      this.pursuit = undefined;
      this.march.execute(unit, context);
    }
    this.march.update(unit, context, ticker);
    this.status = this.march.status;
    return this.status;
  }

  cancel(unit: Unit): void {
    this.pursuit?.cancel(unit);
    this.march.cancel(unit);
    super.cancel(unit);
  }

  getResolvedDestination(): CellCoord | undefined {
    return this.march.getResolvedDestination();
  }

  getCompletionReason(): MoveCompletionReason | undefined {
    return this.march.getCompletionReason();
  }

  getDestination(): CellCoord {
    return { ...this.march.destination };
  }

  getPursuitTarget(): Unit | undefined {
    return this.pursuit?.target;
  }

  private findVisibleTarget(unit: Unit, context: CommandContext): Unit | undefined {
    const unitCell = unit.getGridCell(context.gridConfig);
    if (!unitCell) return undefined;
    let closest: Unit | undefined;
    let closestDistance = Infinity;
    for (const candidate of context.enemies) {
      if (!candidate.active || !candidate.canBeProjectileTarget || !unit.canSee(candidate)) continue;
      const cell = candidate.getGridCell(context.gridConfig);
      if (!cell) continue;
      const distance = Math.hypot(cell.col - unitCell.col, cell.row - unitCell.row);
      if (distance < closestDistance) {
        closest = candidate;
        closestDistance = distance;
      }
    }
    return closest;
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

    const unitCell = unit.getGridCell(context.gridConfig);
    const targetInRange = unitCell && context.enemies.some((enemy) => {
      const targetCell = enemy.getGridCell(context.gridConfig);
      return enemy.active &&
        enemy.canBeProjectileTarget &&
        targetCell &&
        isInRange(unitCell, targetCell, unit.getShootingRange() ?? 0);
    });
    if (targetInRange) {
      unit.clearCommandMovement();
      return "running";
    }

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

  getDestination(): CellCoord | undefined {
    return this.destination && { ...this.destination };
  }
}

export class HoldPositionCommand extends BaseCommand {
  readonly type = "hold" as const;

  execute(unit: Unit, _context: CommandContext): void {
    this.status = "running";
    unit.clearCommandMovement();
    unit.setCommandShooting("auto");
    unit.setActivity("holding");
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
