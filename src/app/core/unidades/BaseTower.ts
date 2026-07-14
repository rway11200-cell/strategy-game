import { Container } from "pixi.js";
import type { GridConfig } from "../../../grid/GridConfig";
import { gridToWorld } from "../../../grid/GridConfig";
import { Unit } from "./Unit";

export class BaseTower extends Unit {
  public col: number = -1;
  public row: number = -1;
  public built: boolean = false;

  constructor(mainContainer: Container) {
    super(mainContainer, { framesJson: { idle: "suelo-torre.json" } });
    this.eventMode = "static";
  }

  setGridPosition(col: number, row: number, gridConfig: GridConfig): void {
    this.col = col;
    this.row = row;
    const world = gridToWorld(col, row, gridConfig);
    this.position.set(world.x, world.y);
  }
}
