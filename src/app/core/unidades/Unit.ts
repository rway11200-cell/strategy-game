import { AnimatedSprite, Container, Graphics, ObservablePoint, PointData, Ticker } from "pixi.js";
import { getDistance } from "../../../engine/utils/maths";
import { debugLogChanged } from "../../utils/debugLog";
import { devToolDrawPoints } from "../../utils/devTools";
import { getFramesAseprite } from "../../utils/sprite";
import { UnitCreator } from "../UnitCreator";
import { MovementDirection, Movement } from "../Movement";
import { TargetFollower } from "../PathFollower";
import { Projectile } from "./Projectile";

export interface ShootOptions {
  range: number;
  fireRate: number;
  targets?: Unit[];
  projectileCreator: UnitCreator<Projectile>;
  damage: number;
}

export interface TargetFollowerOptions {
  targets?: PointData[] | Container[];
  variation?: number;
  speed?: number;
  forceActivatePathFollower?: boolean;
}
export interface FramesJson {
  idle: string;
  run?: string;
  dead?: string;
}
export interface UnitProps {
  framesJson?: FramesJson;
  position?: PointData;
  shootOptions?: ShootOptions;
  targetFollowerOptions?: TargetFollowerOptions;
  health?: number;
}

function isArrayOfUnits(targets: PointData[] | Unit[]): targets is Unit[] {
  return targets.length > 0 && targets[0] instanceof Unit;
}

export class Unit extends Container {
  public active: boolean = false;
  public canBeProjectileTarget = false;
  private lastAnimation: string = "idle";

  private mainContainer: Container;
  private targetFollowerOptions?: TargetFollowerOptions;
  public targetFollower?: TargetFollower;

  private shootOptions?: ShootOptions;
  private lastShotTime: number = 0;
  public targetToShoot?: Unit;

  private rangeGraph?: Graphics;

  private movement?: Movement;

  public animatedSprite?: AnimatedSprite;
  private framesJson?: FramesJson;

  private health?: number;
  private speed: number = 1;
  private currentHealth?: number = this.health;
  private healthBar?: Graphics;
  public onDestroy?: (unit: Unit) => void;

  constructor(mainContainer: Container, options?: UnitProps) {
    super();

    this.mainContainer = mainContainer;
    this.mainContainer.addChild(this);

    if (!options) {
      return;
    }

    const { framesJson, health, shootOptions, targetFollowerOptions, position } = options;
    if (position) {
      this.position = position;
    }

    if (framesJson) {
      this.initializeAnimation(framesJson);
    }

    if (health) {
      this.initializeHealthBar(health);
    }

    if (targetFollowerOptions) {
      this.initializeTargetFollower(targetFollowerOptions);
    }

    if (shootOptions) {
      this.initializeShootingRange(shootOptions);
    }
  }

  public initializeAnimation(framesJson: FramesJson) {
    this.framesJson = framesJson;
    this.animatedSprite = new AnimatedSprite(getFramesAseprite(this.framesJson.idle).textures);
    this.animatedSprite.animationSpeed = 10 / 60;
    this.animatedSprite.anchor.set(0.5);
    this.animatedSprite.visible = false;
    this.addChild(this.animatedSprite);
  }

  public initializeHealthBar(health: number) {
    if (!this.animatedSprite) {
      debugLogChanged(this.getId("initializeHealthBar without this.animatedSprite"));
    }

    const healthYPosition = (this.animatedSprite && this.animatedSprite.height) ?? 100;

    this.healthBar = new Graphics();
    this.health = health;
    this.currentHealth = health;
    const healthHeight = 2;
    const heightAdjustment = 20;
    const healthWidth = 30;

    this.healthBar.rect(0, -healthYPosition / 2 + heightAdjustment, healthWidth, healthHeight).fill("green");
    this.healthBar.position.x = -(healthWidth / 2);
    this.healthBar.visible = false;
    this.addChild(this.healthBar);
  }

  public setShootingTargets(targets: Unit[]) {
    if (!this.shootOptions) {
      console.log("initializeShootingRange first");
      return;
    }

    this.shootOptions.targets = targets;
  }

  public initializeShootingRange(shootOptions: ShootOptions) {
    this.shootOptions = { ...this.shootOptions, ...shootOptions };

    if (this.shootOptions?.range) {
      this.rangeGraph = devToolDrawPoints(
        this,
        { x: 0, y: 0 },
        "yellow",
        this.shootOptions.range,
        "circle",
      );
      this.rangeGraph.visible = false;
    }
  }

  public initializeSpeed(speed: number) {
    this.speed = speed;
  }

  public initializeTargetFollower(targetFollowerOptions: TargetFollowerOptions) {
    this.targetFollowerOptions = {
      ...this.targetFollowerOptions,
      ...targetFollowerOptions,
    };

    if (targetFollowerOptions.speed)
      this.speed = targetFollowerOptions.speed;

    this.movement = new Movement(this.speed ?? 1);

    const targets = this.targetFollowerOptions?.targets;
    if (targets && targets.length > 0) {
      this.targetFollower = new TargetFollower();

      if (isArrayOfUnits(targets)) {
        this.targetFollower.setRouteFromUnits({
          units: targets,
          loop: false,
        });
      } else {
        this.targetFollower.setRouteFromPoints({
          points: targets,
          variation: this.targetFollowerOptions?.variation || 0,
          loop: false,
        });
      }

      const target = this.targetFollower.target;
      if (target) {
        this.position = target;
      }
    } else if (this.targetFollowerOptions?.forceActivatePathFollower) {
      this.targetFollower = new TargetFollower();
    }
  }

  public update(_time: Ticker) {
    if (!this.active || !this.animatedSprite || !this.animatedSprite.visible) return;

    this.updateMovement(_time);
    this.updateHealth();
    this.updateShooting(_time);
  }

  private updateHealth() {
    if (!this.health || !this.currentHealth || !this.healthBar) return;

    const currentHealthPercent = (this.currentHealth * 100) / this.health;
    this.healthBar.visible = currentHealthPercent < 100 && currentHealthPercent > 0;
    this.healthBar.scale.x = currentHealthPercent / 100;
  }

  private updateMovement(_time: Ticker) {
    if (!this.targetFollower) return;

    const target = this.targetFollower.target;
    if (!target) {
      this.setAnimationIdle();
      return;
    }

    if (this.movement?.canWalk()) {
      const { reachedTarget, direction } = this.movement.walk(this, target, _time, 0.5);
      this.setAnimationRun(direction);

      if (reachedTarget) {
        this.targetFollower.advanceToNextTarget();
      }
    }
  }

  private setAnimationIdle() {
    const animation = "idle";
    if (this.lastAnimation === animation) return;
    this.lastAnimation = animation;

    if (!this.animatedSprite || !this.framesJson) return;
    this.animatedSprite.loop = true;
    this.animatedSprite.textures = getFramesAseprite(this.framesJson.idle).textures;
    this.animatedSprite.play();
  }
  private setAnimationRun(direction: MovementDirection | undefined) {
    const animation = "run";

    this.changeFacingDirection(direction);
    if (this.lastAnimation === animation) return;
    this.lastAnimation = animation;

    if (!this.animatedSprite || !this.framesJson) return;
    this.animatedSprite.loop = true;
    this.animatedSprite.textures = getFramesAseprite(
      this.framesJson.run || this.framesJson.idle,
    ).textures;
    this.animatedSprite.play();
  }

  private changeFacingDirection(direction: MovementDirection | undefined) {
    if (!this.animatedSprite || !direction) return;

    let newScale: number = 1;
    if (direction == "left") {
      newScale = -1;
    }

    if (this.animatedSprite.scale.x === newScale) return;

    this.animatedSprite.scale.x = newScale;
  }

  private setAnimationDead(onDeathAction: () => void) {
    const animation = "dead";

    if (this.lastAnimation === animation) return;
    this.lastAnimation = animation;

    if (!this.animatedSprite || !this.framesJson) return;

    if (!this.framesJson.dead) {
      onDeathAction();
      return;
    }

    this.animatedSprite.stop();

    const frames = getFramesAseprite(this.framesJson.dead || this.framesJson.idle);
    this.animatedSprite.loop = false;
    this.animatedSprite.textures = frames.textures;
    this.animatedSprite.play();

    setTimeout(() => {
      onDeathAction();
    }, frames.totalMs);
  }
  private updateShooting(_time: Ticker) {
    const shootOptions = this.shootOptions;
    if (!shootOptions?.range) return;

    if (shootOptions.targets && shootOptions.targets.length > 0) {
      const target = getCurrentOrClosestTarget(
        this.position,
        shootOptions.targets,
        shootOptions.range,
        this.targetToShoot,
      );
      this.targetToShoot = target;
    }

    if (!this.targetToShoot) return;

    const timeSinceLastShot = _time.lastTime - this.lastShotTime;
    const fireRateInMilliseconds = shootOptions.fireRate * 1000;

    if (timeSinceLastShot < fireRateInMilliseconds) return;

    this.lastShotTime = _time.lastTime;

    const newProjectile = shootOptions.projectileCreator.get();
    if (!newProjectile.targetFollower) return;

    newProjectile.targetFollower.setRouteFromUnits({
      units: [this, this.targetToShoot],
    });
    newProjectile.targetFollower.onDestinationReached = () => {
      newProjectile.destroy();
      this.targetToShoot?.damage(this.shootOptions?.damage);
      if (this.targetToShoot?.isDead()) {
        this.targetToShoot = undefined;
      }
    };
    newProjectile.spawn();
  }

  public isDead(): boolean {
    return !this.active;
  }

  public spawn() {
    this.visible = true;
    this.active = true;
    this.canBeProjectileTarget = true;
    if (this.movement) this.movement.active = true;

    if (!this.animatedSprite) {
      debugLogChanged(this.getId("this.animatedSprite not initialized"));
      return;
    }

    this.animatedSprite.visible = true;
    this.animatedSprite.play();

    if (this.targetFollower) {
      this.targetFollower.reset();
      this.position = this.targetFollower.getOrigin();
    }

    if (this.rangeGraph) {
      this.rangeGraph.visible = true;
    }

    if (this.health) {
      this.currentHealth = this.health;
      this.updateHealth();
    }
  }

  public destroy() {
    this.canBeProjectileTarget = false;
    if (this.movement) this.movement.active = false;
    this.onDestroy?.(this);

    this.setAnimationDead(() => {
      this.visible = false;
      this.active = false;

      if (!this.animatedSprite) {
        debugLogChanged(this.getId("this.animatedSprite not initialized"));
        return;
      }
      this.animatedSprite.visible = false;
      this.animatedSprite.stop();
    });
  }

  public damage(amount?: number) {
    if (!amount || !this.currentHealth) {
      return;
    }

    this.currentHealth = this.currentHealth - amount;
    if (this.currentHealth <= 0) {
      this.destroy();
    }
  }

  public getId(complement?: string): string {
    return `${this.constructor.name.toString()}-${this.uid}-${complement}`;
  }
}

function getCurrentOrClosestTarget(
  position: ObservablePoint,
  targets: Unit[],
  range: number,
  currentTarget: Unit | undefined,
): Unit | undefined {
  let closestTarget: Unit | undefined;
  let closestTargetDistance = 1000000000000;

  if (currentTarget && currentTarget.canBeProjectileTarget) {
    const distanceToCurrentTarget = getDistance(
      position.x,
      position.y,
      currentTarget.x,
      currentTarget.y,
    );
    if (distanceToCurrentTarget <= range) {
      return currentTarget;
    }
  }

  targets
    .filter((o) => {
      return o.canBeProjectileTarget;
    })
    .forEach((target) => {
      if (target.active && target.canBeProjectileTarget) {
        const currentDistance = getDistance(position.x, position.y, target.x, target.y);
        if (currentDistance < closestTargetDistance && currentDistance <= range) {
          closestTargetDistance = currentDistance;
          closestTarget = target;
        }
      }
    });
  return closestTarget;
}
