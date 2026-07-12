import { Container } from "pixi.js";
import { Unit, UnitProps } from "./Unit";

export class Projectile extends Unit {
  constructor(mainContainer: Container) {
    const options: UnitProps = {
      framesJson: { idle: "Torre1.json" },
      targetFollowerOptions: {
        forceActivatePathFollower: true,
        speed: 3,
      },
    };
    super(mainContainer, options);
    this.scale.set(0.1, 0.1);
    this.zIndex = 20;
  }
}
