import type { Container, Ticker } from "pixi.js";
import { getEntityFootprint, getFootprintCellsForPos } from "../../grid/EntityFootprint";
import { type CellCoord, gridToWorld, type GridConfig } from "../../grid/GridConfig";
import { GridState } from "../../grid/GridState";
import { interpolatePosition, type MovementDirection } from "./Movement";
import { TargetFollower } from "./PathFollower";

export interface TileMovementOptions {
  gridConfig: GridConfig;
  gridState: GridState;
  start: CellCoord;
  entityType: string;
  occupantId: string;
  ticksPerCell?: number;
  releaseOccupationOnDestination?: boolean;
}

export interface TileWalkResult {
  moved: boolean;
  destinationReached: boolean;
  blocked: boolean;
  direction?: MovementDirection;
}

export class TileMovement {
  public active = true;
  public readonly ticksPerCell: number;

  private readonly gridConfig: GridConfig;
  private readonly gridState: GridState;
  private readonly start: CellCoord;
  private readonly entityType: string;
  private readonly occupantId: string;
  private currentCell?: CellCoord;
  private reservedAnchor?: CellCoord;
  private reservedCells: CellCoord[] = [];
  private elapsedTicks = 0;
  private releaseOccupationOnDestination: boolean;

  constructor(options: TileMovementOptions) {
    this.gridConfig = options.gridConfig;
    this.gridState = options.gridState;
    this.start = { ...options.start };
    this.entityType = options.entityType;
    this.occupantId = options.occupantId;
    this.ticksPerCell = Math.max(1, Math.round(options.ticksPerCell ?? 1));
    this.releaseOccupationOnDestination = options.releaseOccupationOnDestination ?? true;
  }

  get cell(): CellCoord | undefined {
    return this.currentCell ? { ...this.currentCell } : undefined;
  }

  get stepProgress(): number {
    return this.elapsedTicks / Math.max(1, this.ticksPerCell);
  }

  setReleaseOccupationOnDestination(release: boolean): void {
    this.releaseOccupationOnDestination = release;
  }

  cancelStep(obj: Container): void {
    this.elapsedTicks = 0;
    this.releaseReservations();
    if (!this.currentCell) return;
    const world = gridToWorld(this.currentCell.col, this.currentCell.row, this.gridConfig);
    obj.position.set(world.x, world.y);
  }

  spawn(obj: Container): void {
    this.releaseOccupation();
    this.currentCell = { ...this.start };
    this.elapsedTicks = 0;

    const world = gridToWorld(this.start.col, this.start.row, this.gridConfig);
    obj.position.set(world.x, world.y);
    if (this.canOccupy(this.start)) {
      this.occupy(this.start);
    } else {
      this.currentCell = undefined;
    }
  }

  walk(obj: Container, targetFollower: TargetFollower, ticker?: Ticker): TileWalkResult {
    const targetCell = targetFollower.targetCell;
    if (!this.active || !targetCell) {
      return { moved: false, destinationReached: false, blocked: false };
    }

    const target = gridToWorld(targetCell.col, targetCell.row, this.gridConfig);
    const direction = this.getDirection(obj.position.x, target.x);

    if (!this.hasReservation(targetCell)) this.releaseReservations();
    if (!this.hasReservation(targetCell) && !this.reserve(targetCell)) {
      this.elapsedTicks = 0;
      const current = this.currentCell
        ? gridToWorld(this.currentCell.col, this.currentCell.row, this.gridConfig)
        : obj.position;
      obj.position.set(current.x, current.y);
      return { moved: false, destinationReached: false, blocked: true, direction };
    }

    const current = this.currentCell
      ? gridToWorld(this.currentCell.col, this.currentCell.row, this.gridConfig)
      : obj.position;
    this.elapsedTicks = Math.min(
      this.ticksPerCell,
      this.elapsedTicks + Math.max(0, ticker?.deltaTime ?? 1),
    );
    interpolatePosition(obj, current, target, this.elapsedTicks / this.ticksPerCell);

    if (this.elapsedTicks < this.ticksPerCell) {
      return { moved: true, destinationReached: false, blocked: false, direction };
    }
    this.elapsedTicks = 0;

    this.releaseCurrentOccupation();
    this.currentCell = { ...targetCell };
    this.occupy(targetCell);
    this.reservedAnchor = undefined;
    this.reservedCells = [];

    const destinationReached = targetFollower.advanceToNextTarget();
    if (destinationReached && targetFollower.finished && this.releaseOccupationOnDestination) {
      this.releaseOccupation();
      this.currentCell = undefined;
    }

    return { moved: true, destinationReached, blocked: false, direction };
  }

  releaseOccupation(): void {
    this.releaseCurrentOccupation();
    this.releaseReservations();
  }

  private releaseCurrentOccupation(): void {
    for (const cell of this.getCurrentFootprintCells()) {
      if (this.gridState.getCell(cell)?.occupantId === this.occupantId) {
        this.gridState.liberateCell(cell);
      }
    }
  }

  private canOccupy(anchor: CellCoord): boolean {
    const footprint = getEntityFootprint(this.entityType);
    const cells = getFootprintCellsForPos(anchor, footprint.width, footprint.height);

    return cells.every((coord) => {
      const cell = this.gridState.getCell(coord);
      return Boolean(
          cell &&
          cell.type !== "blocked" &&
          (!cell.occupied || cell.occupantId === this.occupantId) &&
          (!cell.reservedBy || cell.reservedBy === this.occupantId),
      );
    });
  }

  private reserve(anchor: CellCoord): boolean {
    if (!this.canOccupy(anchor)) return false;
    const footprint = getEntityFootprint(this.entityType);
    const cells = getFootprintCellsForPos(anchor, footprint.width, footprint.height);
    const reserved: CellCoord[] = [];
    for (const cell of cells) {
      if (!this.gridState.reserveCell(cell, this.occupantId)) {
        for (const previous of reserved) {
          this.gridState.releaseReservation(previous, this.occupantId);
        }
        return false;
      }
      reserved.push(cell);
    }
    this.reservedAnchor = { ...anchor };
    this.reservedCells = reserved;
    return true;
  }

  private releaseReservations(): void {
    for (const cell of this.reservedCells) {
      this.gridState.releaseReservation(cell, this.occupantId);
    }
    this.reservedAnchor = undefined;
    this.reservedCells = [];
  }

  private hasReservation(anchor: CellCoord): boolean {
    return Boolean(
      this.reservedAnchor &&
        this.reservedAnchor.col === anchor.col &&
        this.reservedAnchor.row === anchor.row,
    );
  }

  private occupy(anchor: CellCoord): void {
    const footprint = getEntityFootprint(this.entityType);
    for (const cell of getFootprintCellsForPos(anchor, footprint.width, footprint.height)) {
      this.gridState.occupyCell(cell, this.occupantId);
    }
  }

  private getCurrentFootprintCells(): CellCoord[] {
    if (!this.currentCell) return [];
    const footprint = getEntityFootprint(this.entityType);
    return getFootprintCellsForPos(this.currentCell, footprint.width, footprint.height);
  }

  private getDirection(currentX: number, targetX: number): MovementDirection | undefined {
    if (targetX > currentX) return "right";
    if (targetX < currentX) return "left";
    return undefined;
  }
}
