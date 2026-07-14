import { type CellCoord, gridToWorld, type GridConfig } from "./GridConfig";
import { type CellState, GridState } from "./GridState";
import { findPath, findPathWithFootprint } from "./Pathfinder";
import { getEntityFootprint, getFootprintCellsForPos } from "./EntityFootprint";
import {
  type FootprintSize,
  placeFootprint,
  removeFootprint,
  canPlaceFootprint,
  getOccupantCells,
} from "./OccupationFootprint";
import type { CellRenderData, GridRenderAdapter } from "./render/GridRenderAdapter";
import { gridStateToCellData } from "./render/cellDataBridge";

export interface GridIntegrationConfig {
  gridConfig: GridConfig;
  blockedCells?: CellCoord[];
  spawn: CellCoord;
  base: CellCoord;
}

export class GridIntegration {
  public readonly gridState: GridState;
  public readonly spawn: CellCoord;
  public readonly base: CellCoord;
  private gridConfig: GridConfig;
  public renderAdapter: GridRenderAdapter | null = null;

  constructor(config: GridIntegrationConfig) {
    this.gridConfig = config.gridConfig;
    this.spawn = config.spawn;
    this.base = config.base;
    this.gridState = new GridState(config.gridConfig);

    for (const cell of config.blockedCells ?? []) {
      const existing = this.gridState.getCell(cell);
      if (existing) {
        this.gridState.setCell(cell, { ...existing, type: "blocked", walkCost: 99 });
      }
    }
  }

  /**
   * Computes a path from spawn to base using A*.
   * Returns world-space pixel coordinates so the result can be
   * passed directly to the movement system.
   */
  calculatePath(): { x: number; y: number }[] {
    const path = findPath(this.spawn, this.base, this.gridState);
    return path.map((c) => gridToWorld(c.col, c.row, this.gridConfig));
  }

  isWalkable(col: number, row: number): boolean {
    return this.gridState.isWalkable({ col, row });
  }

  occupyCell(col: number, row: number, occupantId: string): void {
    this.gridState.occupyCell({ col, row }, occupantId);
  }

  liberateCell(col: number, row: number): void {
    this.gridState.liberateCell({ col, row });
  }

  getCell(col: number, row: number): CellState | undefined {
    return this.gridState.getCell({ col, row });
  }

  setCell(col: number, row: number, state: CellState): void {
    this.gridState.setCell({ col, row }, state);
  }

  canPlaceFootprint(col: number, row: number, size: FootprintSize): boolean {
    return canPlaceFootprint({ col, row }, size, this.gridState, this.gridConfig).success;
  }

  placeFootprint(col: number, row: number, size: FootprintSize, occupantId: string): boolean {
    const anchor: CellCoord = { col, row };
    return placeFootprint(anchor, size, occupantId, this.gridState, this.gridConfig);
  }

  removeFootprint(occupantId: string): void {
    removeFootprint(occupantId, this.gridState, this.gridConfig);
  }

  getOccupantCells(occupantId: string): CellCoord[] {
    return getOccupantCells(occupantId, this.gridState, this.gridConfig);
  }

  setRenderAdapter(adapter: GridRenderAdapter | null): void {
    this.renderAdapter = adapter;
  }

  syncRender(): void {
    if (!this.renderAdapter) return;
    this.renderAdapter.render(this.buildCellMatrix());
  }

  calculateEntityPath(entityType: string): { x: number; y: number }[] {
    const path = findPathWithFootprint(this.spawn, this.base, this.gridState, this.gridConfig, entityType);
    return path.map((c) => gridToWorld(c.col, c.row, this.gridConfig));
  }

  occupyEntityCells(anchor: CellCoord, entityType: string, occupantId: string): void {
    const footprint = getEntityFootprint(entityType);
    const cells = getFootprintCellsForPos(anchor, footprint.width, footprint.height);
    for (const c of cells) {
      this.gridState.occupyCell(c, occupantId);
    }
  }

  liberateEntityCells(occupantId: string): void {
    for (let row = 0; row < this.gridConfig.gridHeight; row++) {
      for (let col = 0; col < this.gridConfig.gridWidth; col++) {
        const coord: CellCoord = { col, row };
        const cell = this.gridState.getCell(coord);
        if (cell && cell.occupied && cell.occupantId === occupantId) {
          this.gridState.liberateCell(coord);
        }
      }
    }
  }

  private buildCellMatrix(): CellRenderData[][] {
    const raw: (import("./GridState").CellState | null)[][] = [];
    for (let row = 0; row < this.gridConfig.gridHeight; row++) {
      const rowData: (import("./GridState").CellState | null)[] = [];
      for (let col = 0; col < this.gridConfig.gridWidth; col++) {
        rowData.push(this.gridState.getCell({ col, row }) ?? null);
      }
      raw.push(rowData);
    }
    return gridStateToCellData(raw);
  }
}
