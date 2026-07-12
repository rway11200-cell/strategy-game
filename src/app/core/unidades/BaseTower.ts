import { Container } from "pixi.js";
import { Unit } from "./Unit";

export class BaseTower extends Unit {
  public built: boolean = false;
  constructor(mainContainer: Container) {
    super(mainContainer, { framesJson: { idle: "suelo-torre.json" } });
    this.eventMode = "static";
  }
}
