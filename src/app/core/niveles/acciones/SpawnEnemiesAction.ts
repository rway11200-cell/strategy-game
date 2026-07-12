import { EnemyType } from "../../unidades/Enemy";
import { LevelContext } from "../cargador/LevelContext";
import { LevelAction } from "../cargador/LevelEventManager";
import { PathDef } from "../cargador/LevelSchema";

export type EnemiesProps = {
  type: EnemyType;
  count: number;
};
export class SpawnEnemiesAction implements LevelAction {
  private initialTime?: number;
  private enemiesToSpawn: EnemyType[] = [];
  constructor(
    private path: string,
    private interval: number,
    enemies: EnemiesProps[],
  ) {
    enemies.forEach((e) => {
      for (let i = 0; i < e.count; i++) {
        this.enemiesToSpawn.push(e.type);
      }
    });

    this.enemiesToSpawn.sort(() => Math.random() - 0.5);
  }

  getName(): string {
    return "SpawnEnemiesAction";
  }

  update(gameTimeMs: number, context: LevelContext): boolean {
    const selectedPath = this.findPathForEnemies(context);
    if (!selectedPath) {
      context.showMessage("Error: Enemies have no path to follow");
      return true;
    }

    if (!this.initialTime) {
      this.initialTime = gameTimeMs;
    }

    if (this.initialTime + this.interval <= gameTimeMs) {
      const nextEnemyType: EnemyType = this.enemiesToSpawn.shift()!;

      const unit = context.enemyCreator.get();
      unit.initializeEnemy(nextEnemyType);

      unit.initializeTargetFollower({
        targets: selectedPath.points,
        variation: 40,
      });

      unit.spawn();

      const enemies = context.enemyCreator.getUnits();
      context.towerCreator.applyToAllUnits((tower) => {
        tower.setShootingTargets(enemies);
      });
    }

    return this.enemiesToSpawn.length === 0;
  }

  private findPathForEnemies(context: LevelContext): PathDef | undefined {
    return context.paths.find((c) => {
      return c.id === this.path;
    });
  }
}
