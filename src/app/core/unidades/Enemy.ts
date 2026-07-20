import { Container } from "pixi.js";
import { debugLogChanged } from "../../utils/debugLog";
import { FramesJson, Unit } from "./Unit";

export enum EnemyType {
  Goblin = "goblin",
  Skeleton = "skeleton",
  Ghost = "ghost",
}

type EnemyDefinition = {
  health: number;
  damage: number;
  speed: number;
  range: number;
  framesJson: FramesJson;
  reward: number;
};

const EnemyDefinitions = new Map<EnemyType, EnemyDefinition>([
  [
    EnemyType.Skeleton,
    {
      health: 600,
      damage: 20,
      speed: 0.5,
      range: 1,
      reward: 50,
      framesJson: {
        idle: "esqueleton-idle.json",
        run: "esqueleton-run.json",
        dead: "esqueleton-dead.json",
      },
    },
  ],
  [
    EnemyType.Ghost,
    {
      health: 70,
      damage: 8,
      speed: 1.2,
      range: 1,
      reward: 15,
      framesJson: {
        idle: "fantasma-idle.json",
        run: "fantasma-run.json",
        dead: "fantasma-dead.json",
      },
    },
  ],
  [
    EnemyType.Goblin,
    {
      health: 50,
      damage: 6,
      speed: 0.6,
      range: 1,
      reward: 6,
      framesJson: {
        idle: "goblin scout - silhouette all animations-idle.json",
        run: "goblin scout - silhouette all animations-run.json",
        dead: "goblin scout - silhouette all animations-death 1.json",
      },
    },
  ],
]);

export class Enemy extends Unit {
  private reward: number = 10;
  public enemyType?: EnemyType;

  constructor(mainContainer: Container, options?: { id?: string }) {
    super(mainContainer, { id: options?.id, team: "enemy", controller: "ai" });
  }

  initializeEnemy(nextEnemyType: EnemyType) {
    const enemyDef = EnemyDefinitions.get(nextEnemyType);
    if (!enemyDef) {
      debugLogChanged(this.getId("EnemyDefinition not found"));
      return;
    }

    this.initializeAnimation(enemyDef.framesJson);
    this.initializeHealthBar(enemyDef.health);
    this.initializeSpeed(enemyDef.speed);
    this.model.configure({
      damage: enemyDef.damage,
      range: enemyDef.range,
      team: "enemy",
      controller: "ai",
    });
    this.enemyType = nextEnemyType;
    this.reward = enemyDef.reward;
  }

  public getDeathReward(): number {
    return this.reward;
  }
}
