import { Container } from "pixi.js";
import { Unit, UnitProps } from "./Unit";

export class Tower extends Unit {
  constructor(mainContainer: Container, options: UnitProps) {
    options.framesJson = { idle: "Torre1.json" };

    super(mainContainer, options);
    if (this.animatedSprite) this.animatedSprite.anchor = { x: 0.5, y: 1 };
    this.zIndex = 10;
  }
}
