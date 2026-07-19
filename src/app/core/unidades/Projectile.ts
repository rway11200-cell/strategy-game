import { Container } from "pixi.js";
import type { CellCoord, GridConfig } from "../../../grid/GridConfig";
import { Unit, UnitProps } from "./Unit";

export class Projectile extends Unit {
  public targetCell?: CellCoord;
  public targetUnit?: Unit;

  constructor(mainContainer: Container) {
    const options: UnitProps = {
      framesJson: { idle: "Torre1.json" },
      targetFollowerOptions: {
        forceActivatePathFollower: true,
        speed: 3,
      },
      team: "player",
      controller: "player",
    };
    super(mainContainer, options);
    this.scale.set(0.1, 0.1);
    this.zIndex = 20;
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
    super.destroy();
    this.targetUnit = undefined;
    this.targetCell = undefined;
  }
}
