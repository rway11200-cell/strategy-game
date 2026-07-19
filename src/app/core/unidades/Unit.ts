import { AnimatedSprite, Container, Graphics, PointData, Ticker } from "pixi.js";
import type { CellCoord, GridConfig } from "../../../grid/GridConfig";
import { worldToGrid } from "../../../grid/GridConfig";
import type { GridState } from "../../../grid/GridState";
import { debugLogChanged } from "../../utils/debugLog";
import { devToolDrawPoints } from "../../utils/devTools";
import { getFramesAseprite } from "../../utils/sprite";
import { UnitCreator } from "../UnitCreator";
import { MovementDirection, Movement } from "../Movement";
import { TargetFollower } from "../PathFollower";
import { TileMovement, type TileWalkResult } from "../TileMovement";
import {
  type CommandContext,
  type CommandPathfinder,
  defaultCommandPathfinder,
  type IUnitCommand,
} from "../UnitCommands";
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

export interface TileTargetFollowerOptions {
  cells: CellCoord[];
  gridConfig: GridConfig;
  gridState: GridState;
  start: CellCoord;
  entityType: string;
  ticksPerCell?: number;
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
  private combatGridConfig?: GridConfig;
  private lastShotTime: number = 0;
  public targetToShoot?: Unit;
  private shootingMode: "auto" | "forced" | "disabled" = "auto";
  private forcedShootingTarget?: Unit;

  private rangeGraph?: Graphics;

  private movement?: Movement;
  private tileMovement?: TileMovement;
  private commandContext?: CommandContext;
  public currentCommand?: IUnitCommand;

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
    if (this.commandContext) this.commandContext.enemies = targets;
    if (this.targetToShoot && !targets.includes(this.targetToShoot)) {
      this.targetToShoot = undefined;
    }
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
      if (this.combatGridConfig) {
        this.rangeGraph.scale.set(this.combatGridConfig.cellSize);
      }
      this.rangeGraph.visible = false;
    }
  }

  public setCombatGrid(gridConfig: GridConfig): void {
    this.combatGridConfig = gridConfig;
    this.rangeGraph?.scale.set(gridConfig.cellSize);
  }

  public getGridCell(gridConfig: GridConfig = this.combatGridConfig!): CellCoord | undefined {
    const movementCell = this.tileMovement?.cell;
    if (movementCell) return movementCell;
    if (!gridConfig) return;

    const cell = worldToGrid(this.position.x, this.position.y, gridConfig);
    if (cell.x < 0 || cell.y < 0 || cell.x >= gridConfig.gridWidth || cell.y >= gridConfig.gridHeight) {
      return;
    }
    return { col: cell.x, row: cell.y };
  }

  public initializeSpeed(speed: number) {
    this.speed = speed;
  }

  public initializeTargetFollower(targetFollowerOptions: TargetFollowerOptions) {
    this.currentCommand?.cancel(this);
    this.currentCommand = undefined;
    this.commandContext = undefined;
    this.tileMovement?.releaseOccupation();
    this.tileMovement = undefined;
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

  public initializeTileMovement(options: TileTargetFollowerOptions) {
    this.currentCommand?.cancel(this);
    this.currentCommand = undefined;
    this.setCombatGrid(options.gridConfig);
    this.targetFollower = new TargetFollower();
    this.targetFollower.setRouteFromCells({
      cells: options.cells,
      gridConfig: options.gridConfig,
    });

    this.tileMovement?.releaseOccupation();
    const occupantId = this.getId();
    this.tileMovement = new TileMovement({
      ...options,
      occupantId,
      ticksPerCell: options.ticksPerCell ?? Math.max(1, Math.round(1 / this.speed)),
    });
    this.commandContext = {
      gridConfig: options.gridConfig,
      gridState: options.gridState,
      pathfinder: defaultCommandPathfinder,
      enemies: this.shootOptions?.targets ?? [],
      entityType: options.entityType,
      occupantId,
    };
  }

  public issueCommand(command: IUnitCommand): void {
    this.currentCommand?.cancel(this);
    this.currentCommand = undefined;
    if (!this.commandContext) return;

    this.currentCommand = command;
    command.execute(this, this.commandContext);
    if (command.status !== "running") this.currentCommand = undefined;
  }

  public setCommandPathfinder(pathfinder: CommandPathfinder): void {
    if (this.commandContext) this.commandContext.pathfinder = pathfinder;
  }

  public setCommandCellRoute(cells: CellCoord[], loop = false): void {
    if (!this.targetFollower || !this.commandContext || !this.tileMovement) return;
    this.tileMovement.setReleaseOccupationOnDestination(false);
    this.tileMovement.resetStepProgress();
    this.targetFollower.setRouteFromCells({
      cells,
      gridConfig: this.commandContext.gridConfig,
      loop,
    });
  }

  public clearCommandMovement(): void {
    this.targetFollower?.clear();
    this.tileMovement?.resetStepProgress();
    this.setAnimationIdle();
  }

  public updateCommandMovement(ticker: Ticker): TileWalkResult {
    return this.updateMovement(ticker);
  }

  public isCommandMovementFinished(): boolean {
    return this.targetFollower?.finished ?? true;
  }

  public getShootingRange(): number | undefined {
    return this.shootOptions?.range;
  }

  public setCommandShooting(
    mode: "auto" | "forced" | "disabled",
    target?: Unit,
  ): void {
    this.shootingMode = mode;
    this.forcedShootingTarget = mode === "forced" ? target : undefined;
    this.targetToShoot = undefined;
  }

  public update(_time: Ticker) {
    if (!this.active || !this.animatedSprite || !this.animatedSprite.visible) return;

    if (this.currentCommand && this.commandContext) {
      const status = this.currentCommand.update(this, this.commandContext, _time);
      if (status !== "running") this.currentCommand = undefined;
    } else {
      this.updateMovement(_time);
    }
    this.updateHealth();
    this.updateShooting(_time);
  }

  private updateHealth() {
    if (!this.health || !this.currentHealth || !this.healthBar) return;

    const currentHealthPercent = (this.currentHealth * 100) / this.health;
    this.healthBar.visible = currentHealthPercent < 100 && currentHealthPercent > 0;
    this.healthBar.scale.x = currentHealthPercent / 100;
  }

  private updateMovement(_time: Ticker): TileWalkResult {
    const noMovement = { moved: false, destinationReached: false, blocked: false };
    if (!this.targetFollower) return noMovement;

    if (this.tileMovement) {
      const targetCell = this.targetFollower.targetCell;
      if (!targetCell) {
        this.setAnimationIdle();
        return noMovement;
      }

      const result = this.tileMovement.walk(this, this.targetFollower);
      const { direction } = result;
      this.setAnimationRun(direction);
      return result;
    }

    const target = this.targetFollower.target;
    if (!target) {
      this.setAnimationIdle();
      return noMovement;
    }

    if (this.movement?.canWalk()) {
      const { reachedTarget, direction } = this.movement.walk(this, target, _time, 0.5);
      this.setAnimationRun(direction);

      if (reachedTarget) {
        this.targetFollower.advanceToNextTarget();
      }
    }
    return noMovement;
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
    if (this.shootingMode === "disabled") return;

    const shootOptions = this.shootOptions;
    const gridConfig = this.combatGridConfig;
    const towerCell = this.getGridCell();
    if (!shootOptions?.range || !gridConfig || !towerCell) return;

    if (this.shootingMode === "forced") {
      const target = this.forcedShootingTarget;
      const targetCell = target?.getGridCell(gridConfig);
      this.targetToShoot =
        target?.active &&
        target.canBeProjectileTarget &&
        targetCell &&
        getCellDistance(towerCell, targetCell) <= shootOptions.range
          ? target
          : undefined;
    } else {
      this.targetToShoot = getCurrentOrClosestGridTarget(
        towerCell,
        shootOptions.targets ?? [],
        shootOptions.range,
        gridConfig,
        this.targetToShoot,
      );
    }

    if (!this.targetToShoot) return;

    const timeSinceLastShot = _time.lastTime - this.lastShotTime;
    const fireRateInMilliseconds = shootOptions.fireRate * 1000;

    if (timeSinceLastShot < fireRateInMilliseconds) return;

    this.lastShotTime = _time.lastTime;

    const target = this.targetToShoot;
    const targetCell = target.getGridCell(gridConfig);
    if (!targetCell) return;

    const newProjectile = shootOptions.projectileCreator.get();
    newProjectile.launchAtCell(towerCell, targetCell, gridConfig, target, () => {
      if (target.canBeProjectileTarget) {
        target.damage(shootOptions.damage);
      }
      if (target.isDead() && this.targetToShoot === target) {
        this.targetToShoot = undefined;
      }
    });
  }

  public isDead(): boolean {
    return !this.active;
  }

  public spawn() {
    this.visible = true;
    this.active = true;
    this.canBeProjectileTarget = true;
    if (this.movement) this.movement.active = true;
    if (this.tileMovement) this.tileMovement.active = true;

    if (!this.animatedSprite) {
      debugLogChanged(this.getId("this.animatedSprite not initialized"));
      return;
    }

    this.animatedSprite.visible = true;
    this.animatedSprite.play();

    if (this.targetFollower) {
      this.targetFollower.reset();
      if (this.tileMovement) {
        this.tileMovement.spawn(this);
      } else {
        this.position = this.targetFollower.getOrigin();
      }
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
    this.currentCommand?.cancel(this);
    this.currentCommand = undefined;
    this.canBeProjectileTarget = false;
    if (this.movement) this.movement.active = false;
    if (this.tileMovement) {
      this.tileMovement.active = false;
      this.tileMovement.releaseOccupation();
    }
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

export function getCurrentOrClosestGridTarget(
  position: CellCoord,
  targets: Unit[],
  range: number,
  gridConfig: GridConfig,
  currentTarget: Unit | undefined,
): Unit | undefined {
  let closestTarget: Unit | undefined;
  let closestTargetDistance = Number.POSITIVE_INFINITY;

  if (currentTarget && currentTarget.canBeProjectileTarget) {
    const currentTargetCell = currentTarget.getGridCell(gridConfig);
    if (currentTargetCell && getCellDistance(position, currentTargetCell) <= range) {
      return currentTarget;
    }
  }

  targets
    .filter((o) => {
      return o.canBeProjectileTarget;
    })
    .forEach((target) => {
      if (target.active && target.canBeProjectileTarget) {
        const targetCell = target.getGridCell(gridConfig);
        if (!targetCell) return;
        const currentDistance = getCellDistance(position, targetCell);
        if (currentDistance < closestTargetDistance && currentDistance <= range) {
          closestTargetDistance = currentDistance;
          closestTarget = target;
        }
      }
    });
  return closestTarget;
}

function getCellDistance(origin: CellCoord, target: CellCoord): number {
  return Math.hypot(target.col - origin.col, target.row - origin.row);
}
