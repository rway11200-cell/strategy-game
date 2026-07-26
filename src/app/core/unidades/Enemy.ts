import { Container } from "pixi.js";
import { debugLogChanged } from "../../utils/debugLog";
import { type ArmorType } from "./UnitSystem";
import type { ProjectileVisual } from "./Projectile";
import { FramesJson, Unit } from "./Unit";

export enum EnemyType {
  Goblin = "goblin",
  Skeleton = "skeleton",
  Ghost = "ghost",
  Warrior = "warrior",
  Archer = "archer",
}

type EnemyDefinition = {
  health: number;
  damage: number;
  speed: number;
  range: number;
  framesJson: FramesJson;
  reward: number;
  armorType: ArmorType;
  projectileVisual?: ProjectileVisual;
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
      armorType: "heavy",
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
      armorType: "light",
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
      armorType: "unarmored",
      framesJson: {
        idle: "goblin scout - silhouette all animations-idle.json",
        run: "goblin scout - silhouette all animations-run.json",
        dead: "goblin scout - silhouette all animations-death 1.json",
      },
    },
  ],
  [
    EnemyType.Warrior,
    {
      health: 100,
      damage: 12,
      speed: 0.7,
      range: 1,
      reward: 10,
      armorType: "light",
      framesJson: {
        idle: "warrior-idle.json",
        run: "warrior-run.json",
        attack: "warrior-attack.json",
      },
    },
  ],
  [
    EnemyType.Archer,
    {
      health: 80,
      damage: 20,
      speed: 0.8,
      range: 3,
      reward: 20,
      armorType: "light",
      framesJson: {
        idle: "archer-idle.json",
        attack: "archer-attack.json",
      },
      projectileVisual: {
        framesJson: { idle: "archer-arrow.json" },
        scale: 0.6,
        flipTowardTarget: true,
      },
    },
  ],
]);

export class Enemy extends Unit {
  private reward: number = 10;
  public enemyType?: EnemyType;
  public projectileVisual?: ProjectileVisual;

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
      armorType: enemyDef.armorType,
    });
    this.enemyType = nextEnemyType;
    this.projectileVisual = enemyDef.projectileVisual;
    this.reward = enemyDef.reward;
  }

  public getDeathReward(): number {
    return this.reward;
  }
}
