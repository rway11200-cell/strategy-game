import { Container } from "pixi.js";
import type { CellCoord, GridConfig } from "../../../core/grid/GridConfig";
import { type FramesJson, Unit, type UnitProps } from "./Unit";

export interface ProjectileVisual {
  framesJson: FramesJson;
  scale: number;
  flipTowardTarget?: boolean;
}

const DEFAULT_PROJECTILE_VISUAL: ProjectileVisual = {
  framesJson: { idle: "Torre1.json" },
  scale: 0.1,
};

export class Projectile extends Unit {
  public targetCell?: CellCoord;
  public targetUnit?: Unit;
  private visual: ProjectileVisual;

  constructor(mainContainer: Container) {
    const visual = DEFAULT_PROJECTILE_VISUAL;
    const options: UnitProps = {
      framesJson: visual.framesJson,
      targetFollowerOptions: {
        forceActivatePathFollower: true,
        speed: 3,
      },
      team: "player",
      controller: "player",
    };
    super(mainContainer, options);
    this.visual = visual;
    this.scale.set(visual.scale);
    this.zIndex = 20;
  }

  public setVisual(visual?: ProjectileVisual): void {
    this.visual = visual ?? DEFAULT_PROJECTILE_VISUAL;
    this.initializeAnimation(this.visual.framesJson);
    this.scale.set(this.visual.scale);
    this.animatedSprite?.scale.set(1);
  }

  public launchAtCell(
    originCell: CellCoord,
    targetCell: CellCoord,
    gridConfig: GridConfig,
    targetUnit: Unit,
    onImpact: () => void,
  ): void {
    if (!this.targetFollower) return;

    this.targetCell = { ...targetCell };
    this.targetUnit = targetUnit;
    if (this.visual.flipTowardTarget && this.animatedSprite) {
      this.animatedSprite.scale.x = targetCell.col < originCell.col ? -1 : 1;
    }
    this.targetFollower.setRouteFromCells({
      cells: [originCell, targetCell],
      gridConfig,
    });
    this.targetFollower.onDestinationReached = () => {
      this.destroy();
      onImpact();
    };
    this.spawn();
  }

  public destroy(): void {
    // Projectiles return to the pool on impact; they must not run Unit's death/corpse lifecycle.
    this.despawnImmediately();
    this.targetUnit = undefined;
    this.targetCell = undefined;
  }
}
