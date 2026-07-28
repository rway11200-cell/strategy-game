import { UnitArchetype, initializeUnitArchetype } from "../../unidades/UnitArchetype";
import type { CellCoord } from "../../../../core/grid/GridConfig";
import { LevelContext } from "../cargador/LevelContext";
import { LevelAction } from "../cargador/LevelEventManager";
import { PathDef } from "../cargador/LevelSchema";

export type UnitSpawnProps = {
  type: UnitArchetype;
  count: number;
};
export class SpawnUnitsAction implements LevelAction {
  private initialTime?: number;
  private unitsToSpawn: UnitArchetype[] = [];
  private cellPaths = new Map<UnitArchetype, CellCoord[]>();
  constructor(
    private path: string,
    private interval: number,
    units: UnitSpawnProps[],
  ) {
    units.forEach((e) => {
      for (let i = 0; i < e.count; i++) {
        this.unitsToSpawn.push(e.type);
      }
    });

    this.unitsToSpawn.sort(() => Math.random() - 0.5);
  }

  getName(): string {
    return "SpawnUnitsAction";
  }

  update(gameTimeMs: number, context: LevelContext): boolean {
    const selectedPath = this.findPathForEnemies(context);
    if (!selectedPath) {
      context.showMessage("Error: Units have no path to follow");
      return true;
    }

    if (selectedPath.grid && context.gridIntegration && this.cellPaths.size === 0) {
      new Set(this.unitsToSpawn).forEach((archetype) => {
        this.cellPaths.set(archetype, context.gridIntegration!.calculateEntityCellPath(archetype));
      });
    }

    if (!this.initialTime) {
      this.initialTime = gameTimeMs;
    }

    if (this.initialTime + this.interval <= gameTimeMs) {
      const archetype = this.unitsToSpawn.shift()!;

      const unit = context.unitCreator.get();
      initializeUnitArchetype(unit, archetype, { team: "enemy", controller: "ai" });

      if (selectedPath.grid && context.gridIntegration) {
        const grid = context.gridIntegration;
        const cellPath = this.cellPaths.get(archetype) ?? [];
        unit.initializeTileMovement({
          cells: cellPath,
          gridConfig: grid.gridConfig,
          gridState: grid.gridState,
          start: grid.spawn,
          entityType: archetype,
        });
      } else {
        unit.initializeTargetFollower({
          targets: selectedPath.points,
          variation: 40,
        });
      }

      unit.spawn();

      const units = context.unitCreator.getUnits();
      context.towerCreator.applyToAllUnits((tower) => {
        tower.setShootingTargets(units.filter((candidate) => tower.isHostileTo(candidate)));
      });
    }

    return this.unitsToSpawn.length === 0;
  }

  private findPathForEnemies(context: LevelContext): PathDef | undefined {
    return context.paths.find((c) => {
      return c.id === this.path;
    });
  }
}
