import { Container } from "pixi.js";
import type { GridConfig } from "../../../grid/GridConfig";
import { gridToWorld } from "../../../grid/GridConfig";
import { Unit, UnitProps } from "./Unit";

export class Tower extends Unit {
  public col: number = -1;
  public row: number = -1;

  constructor(mainContainer: Container, options: UnitProps) {
    super(mainContainer, {
      ...options,
      framesJson: { idle: "Torre1.json" },
      team: options.team ?? "player",
      controller: options.controller ?? "player",
    });
    if (this.animatedSprite) this.animatedSprite.anchor = { x: 0.5, y: 1 };
    this.zIndex = 10;
  }

  setGridPosition(col: number, row: number, gridConfig: GridConfig): void {
    this.setCombatGrid(gridConfig);
    this.col = col;
    this.row = row;
    const world = gridToWorld(col, row, gridConfig);
    this.position.set(world.x, world.y);
  }
}
