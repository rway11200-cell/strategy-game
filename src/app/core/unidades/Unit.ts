import { AnimatedSprite, Circle, Container, type FederatedPointerEvent, Graphics, PointData, Ticker } from "pixi.js";
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
import {
  type AttackMode,
  UnitSystem,
  type UnitController,
  type UnitFaction,
  type UnitState,
  type UnitStats,
  type UnitTeam,
} from "./UnitSystem";

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
  attack?: string;
  dead?: string;
}

interface PendingMeleeAttack {
  target: Unit;
  impactAt: number;
  completesAt: number;
  damageApplied: boolean;
}

interface DeathPof {
  framesRemaining: number;
  initialScaleX: number;
  initialScaleY: number;
  initialAlpha: number;
  onComplete: () => void;
}
export interface UnitProps {
  id?: string;
  framesJson?: FramesJson;
  position?: PointData;
  shootOptions?: ShootOptions;
  targetFollowerOptions?: TargetFollowerOptions;
  health?: number;
  hp?: number;
  maxHp?: number;
  damage?: number;
  speed?: number;
  range?: number;
  vision?: number;
  team?: UnitTeam;
  faction?: UnitFaction;
  state?: UnitState;
  controller?: UnitController;
  attackMode?: AttackMode;
  cooldown?: number;
}

function isArrayOfUnits(targets: PointData[] | Unit[]): targets is Unit[] {
  return targets.length > 0 && targets[0] instanceof Unit;
}

export class Unit extends Container {
  public active: boolean = false;
  public canBeProjectileTarget = false;
  public readonly model: UnitSystem;
  public readonly unitSystem: UnitSystem;
  private lastAnimation: string = "idle";

  private mainContainer: Container;
  private targetFollowerOptions?: TargetFollowerOptions;
  public targetFollower?: TargetFollower;

  private shootOptions?: ShootOptions;
  private combatGridConfig?: GridConfig;
  private lastShotTime: number = 0;
  private pendingMeleeAttack?: PendingMeleeAttack;
  private deathPof?: DeathPof;
  private autoPursuitTarget?: Unit;
  private autoPursuitTargetCell?: CellCoord;
  public targetToShoot?: Unit;
  private shootingMode: "auto" | "forced" | "disabled" = "auto";
  private forcedShootingTarget?: Unit;

  private rangeGraph?: Graphics;
  private selectionIndicator: Graphics;
  private selectionHandler?: (unit: Unit) => void;

  private movement?: Movement;
  private tileMovement?: TileMovement;
  private commandContext?: CommandContext;
  public currentCommand?: IUnitCommand;
  private lastCommandMovement?: TileWalkResult;
  private readonly stableId?: string;

  public animatedSprite?: AnimatedSprite;
  private framesJson?: FramesJson;

  private health?: number;
  private currentHealth?: number = this.health;
  private healthBar?: Graphics;
  public onDestroy?: (unit: Unit) => void;

  constructor(mainContainer: Container, options?: UnitProps) {
    super();

    this.model = new UnitSystem({
      hp: options?.hp ?? options?.health,
      maxHp: options?.maxHp ?? options?.health,
      damage: options?.damage ?? options?.shootOptions?.damage,
      speed: options?.speed ?? options?.targetFollowerOptions?.speed,
      range: options?.range ?? options?.shootOptions?.range,
      vision: options?.vision,
      team: options?.team,
      faction: options?.faction,
      state: options?.state,
      controller: options?.controller,
      attackMode: options?.attackMode ?? (options?.shootOptions ? "projectile" : undefined),
      cooldown: options?.cooldown,
      position: this.position,
    });
    this.unitSystem = this.model;
    this.health = this.model.maxHp;
    this.currentHealth = this.model.hp;

    this.stableId = options?.id;
    this.mainContainer = mainContainer;
    this.mainContainer.addChild(this);
    this.selectionIndicator = new Graphics()
      .circle(0, 16, 25)
      .stroke({ color: 0xffd54f, width: 2 });
    this.selectionIndicator.visible = false;
    this.addChild(this.selectionIndicator);

    if (!options) {
      return;
    }

    const { framesJson, health, hp, maxHp, shootOptions, targetFollowerOptions, position } = options;
    if (position) {
      this.position.set(position.x, position.y);
    }

    if (framesJson) {
      this.initializeAnimation(framesJson);
    }

    const initialHealth = maxHp ?? hp ?? health;
    if (initialHealth !== undefined) {
      this.initializeHealthBar(initialHealth);
      if (hp !== undefined) {
        this.model.configure({ hp, maxHp: initialHealth });
        this.currentHealth = this.model.hp;
      }
    }

    if (targetFollowerOptions) {
      this.initializeTargetFollower(targetFollowerOptions);
    }

    if (shootOptions) {
      this.initializeShootingRange(shootOptions);
    }
  }

  public get hp(): number {
    return this.model.hp;
  }

  public get maxHp(): number {
    return this.model.maxHp;
  }

  public get attackDamage(): number {
    return this.model.damage;
  }

  public get speed(): number {
    return this.model.speed;
  }

  public get range(): number {
    return this.model.range;
  }

  public get vision(): number {
    return this.model.vision;
  }

  public get activity(): UnitState {
    return this.model.state;
  }

  public setSelectionHandler(handler?: (unit: Unit) => void): void {
    if (this.selectionHandler === handler) return;
    this.off("pointerdown", this.handleSelection);
    this.selectionHandler = handler;
    this.eventMode = handler ? "static" : "none";
    this.cursor = handler ? "pointer" : "default";
    this.hitArea = handler ? new Circle(0, 0, 28) : undefined;
    if (handler) this.on("pointerdown", this.handleSelection);
  }

  public setSelected(selected: boolean): void {
    this.selectionIndicator.visible = selected;
    if (this.rangeGraph) this.rangeGraph.visible = selected;
  }

  public setActivity(activity: Exclude<UnitState, "dead">): void {
    if (this.model.state !== "dead") this.model.state = activity;
  }

  private handleSelection = (event: FederatedPointerEvent): void => {
    event.stopPropagation();
    this.selectionHandler?.(this);
  };

  public get team(): UnitTeam {
    return this.model.team;
  }

  public set team(team: UnitTeam) {
    this.model.team = team;
  }

  public get faction(): UnitFaction {
    return this.model.faction;
  }

  public set faction(faction: UnitFaction) {
    this.model.faction = faction;
  }

  public get state(): UnitState {
    return this.model.state;
  }

  public get controller(): UnitController {
    return this.model.controller;
  }

  public get stats(): UnitStats {
    return this.model.stats;
  }

  public get isAIControlled(): boolean {
    return this.controller === "ai";
  }

  public isHostileTo(other: Unit): boolean {
    return this.model.isHostileTo(other.model);
  }

  public initializeAnimation(framesJson: FramesJson) {
    this.framesJson = framesJson;
    if (this.animatedSprite) {
      this.animatedSprite.textures = getFramesAseprite(this.framesJson.idle).textures;
      this.animatedSprite.visible = false;
      return;
    }
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

    if (!this.healthBar) {
      this.healthBar = new Graphics();
      this.addChild(this.healthBar);
    } else {
      this.healthBar.clear();
    }
    this.health = Math.max(0, health);
    this.currentHealth = this.health;
    this.model.configure({ hp: this.health, maxHp: this.health });
    const healthHeight = 2;
    const heightAdjustment = 20;
    const healthWidth = 30;

    this.healthBar.rect(0, -healthYPosition / 2 + heightAdjustment, healthWidth, healthHeight).fill("green");
    this.healthBar.position.x = -(healthWidth / 2);
    this.healthBar.visible = false;
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
    this.model.configure({ damage: shootOptions.damage, range: shootOptions.range });

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
    this.model.configure({ speed });
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

    if (targetFollowerOptions.speed !== undefined)
      this.model.configure({ speed: targetFollowerOptions.speed });

    this.movement = new Movement(this.speed);

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
        this.position.set(target.x, target.y);
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
      ticksPerCell:
        options.ticksPerCell ?? Math.max(1, Math.round(options.gridConfig.cellSize / this.speed)),
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
    this.autoPursuitTarget = undefined;
    this.autoPursuitTargetCell = undefined;
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
    this.tileMovement.cancelStep(this);
    this.targetFollower.setRouteFromCells({
      cells,
      gridConfig: this.commandContext.gridConfig,
      loop,
    });
  }

  public clearCommandMovement(): void {
    this.targetFollower?.clear();
    this.tileMovement?.cancelStep(this);
    this.setAnimationIdle();
  }

  public freezeMovement(): void {
    this.targetFollower?.clear();
    if (this.tileMovement) {
      this.tileMovement.active = false;
      this.tileMovement.completeStep(this);
    }
    this.setAnimationIdle();
  }

  public updateCommandMovement(ticker: Ticker): TileWalkResult {
    this.lastCommandMovement = this.updateMovement(ticker);
    return this.lastCommandMovement;
  }

  public getLastCommandMovementResult(): TileWalkResult | undefined {
    return this.lastCommandMovement;
  }

  public isCommandMovementFinished(): boolean {
    return this.targetFollower?.finished ?? true;
  }

  public getCommandMovementState(): {
    route: CellCoord[];
    targetCell: CellCoord | null;
    stepProgress: number;
  } {
    const route = this.targetFollower?.cellRoute ?? [];
    const targetCell = this.targetFollower?.targetCell
      ? { ...this.targetFollower.targetCell }
      : null;
    const stepProgress = this.tileMovement?.stepProgress ?? 0;
    return { route, targetCell, stepProgress };
  }

  public getShootingMode(): "auto" | "forced" | "disabled" {
    return this.shootingMode;
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

    if (this.model.state === "dead") {
      this.updateDeathPof(_time);
      return;
    }

    this.lastCommandMovement = undefined;

    if (this.currentCommand && this.commandContext) {
      const status = this.currentCommand.update(this, this.commandContext, _time);
      if (status !== "running") {
        this.currentCommand = undefined;
        if (!this.isMovementActionActive()) this.setActivity("idle");
      }
    } else {
      this.updateAutomaticPursuit();
      this.updateMovement(_time);
    }
    this.updateHealth();
    if (!this.isMovementActionActive()) this.updateShooting(_time);
  }

  private isMovementActionActive(): boolean {
    return this.targetFollower?.targetCell !== undefined || (this.tileMovement?.stepProgress ?? 0) > 0;
  }

  private updateHealth() {
    if (this.health === undefined || this.health <= 0 || !this.healthBar) return;

    this.currentHealth = this.model.hp;
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

      const result = this.tileMovement.walk(this, this.targetFollower, _time);
      const { direction } = result;
      if (result.blocked) this.setActivity("blocked");
      else if (result.moved && !this.targetFollower.finished) {
        this.setActivity(
          !this.currentCommand || this.currentCommand.type === "attack" || this.currentCommand.type === "attack-move"
            ? "pursuing"
            : "moving",
        );
        this.setAnimationRun(direction);
      }
      else this.setAnimationIdle();
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
        if (this.targetFollower.finished) this.setAnimationIdle();
      }
    }
    return noMovement;
  }

  private updateAutomaticPursuit(): void {
    if (
      this.shootingMode !== "auto" ||
      !this.shootOptions ||
      !this.commandContext ||
      !this.tileMovement
    ) {
      return;
    }

    const unitCell = this.getGridCell(this.commandContext.gridConfig);
    if (!unitCell) return;

    const target = this.getAutoPursuitTarget(unitCell);
    const targetCell = target?.getGridCell(this.commandContext.gridConfig);
    if (!target || !targetCell) {
      if (this.autoPursuitTarget) this.clearCommandMovement();
      if (!this.isMovementActionActive()) this.setActivity("idle");
      this.autoPursuitTarget = undefined;
      this.autoPursuitTargetCell = undefined;
      return;
    }

    if (this.isInRange(unitCell, targetCell)) {
      if (this.autoPursuitTarget) this.clearCommandMovement();
      this.setActivity("idle");
      this.autoPursuitTarget = target;
      this.autoPursuitTargetCell = { ...targetCell };
      return;
    }

    const targetChanged = this.autoPursuitTarget !== target ||
      !this.autoPursuitTargetCell ||
      this.autoPursuitTargetCell.col !== targetCell.col ||
      this.autoPursuitTargetCell.row !== targetCell.row ||
      this.isCommandMovementFinished();
    if (!targetChanged) return;

    this.autoPursuitTarget = target;
    this.autoPursuitTargetCell = { ...targetCell };
    const path = this.findPathToAttackRange(unitCell, targetCell);
    if (path) {
      this.setActivity("pursuing");
      this.setCommandCellRoute(path);
    }
    else this.clearCommandMovement();
  }

  private getAutoPursuitTarget(unitCell: CellCoord): Unit | undefined {
    const current = this.autoPursuitTarget;
    if (current?.active && current.canBeProjectileTarget && this.canSee(current)) return current;

    let closest: Unit | undefined;
    let closestDistance = Infinity;
    for (const target of this.shootOptions?.targets ?? []) {
      if (!target.active || !target.canBeProjectileTarget) continue;
      if (!this.canSee(target)) continue;
      const targetCell = target.getGridCell(this.commandContext!.gridConfig);
      if (!targetCell) continue;
      const distance = Math.hypot(targetCell.col - unitCell.col, targetCell.row - unitCell.row);
      if (distance < closestDistance) {
        closest = target;
        closestDistance = distance;
      }
    }
    return closest;
  }

  public canSee(target: Unit): boolean {
    const gridConfig = this.commandContext?.gridConfig ?? this.combatGridConfig;
    const unitCell = gridConfig && this.getGridCell(gridConfig);
    const targetCell = gridConfig && target.getGridCell(gridConfig);
    return Boolean(
      unitCell &&
      targetCell &&
      Math.hypot(targetCell.col - unitCell.col, targetCell.row - unitCell.row) <= this.vision,
    );
  }

  private findPathToAttackRange(start: CellCoord, target: CellCoord): CellCoord[] | undefined {
    const context = this.commandContext;
    if (!context) return;

    let bestPath: CellCoord[] | undefined;
    for (let row = 0; row < context.gridConfig.gridHeight; row++) {
      for (let col = 0; col < context.gridConfig.gridWidth; col++) {
        const destination = { col, row };
        if (!this.isInRange(destination, target)) continue;
        const path = context.pathfinder.findPath(
          start,
          destination,
          context.gridState,
          context.gridConfig,
          context.entityType,
          context.occupantId,
        );
        if (path.length > 0 && (!bestPath || path.length < bestPath.length)) bestPath = path;
      }
    }
    return bestPath;
  }

  private setAnimationIdle() {
    const animation = "idle";
    if (this.lastAnimation === "attack" && this.animatedSprite?.playing) return;
    if (this.model.state !== "dead") this.model.state = "idle";
    if (this.lastAnimation === animation) return;
    this.lastAnimation = animation;

    if (!this.animatedSprite || !this.framesJson) return;
    this.animatedSprite.loop = true;
    this.animatedSprite.textures = getFramesAseprite(this.framesJson.idle).textures;
    this.animatedSprite.play();
  }
  private setAnimationRun(direction: MovementDirection | undefined) {
    const animation = "run";
    if (this.lastAnimation === "attack" && this.animatedSprite?.playing) return;
    if (this.model.state !== "dead") this.model.state = "moving";

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

  private setAnimationAttack(direction: MovementDirection | undefined): number {
    const animation = "attack";
    if (!this.animatedSprite || !this.framesJson?.attack) return 0;

    this.model.state = "attacking";
    this.changeFacingDirection(direction);
    this.lastAnimation = animation;

    const frames = getFramesAseprite(this.framesJson.attack);
    this.animatedSprite.stop();
    this.animatedSprite.loop = false;
    this.animatedSprite.textures = frames.textures;
    this.animatedSprite.onComplete = () => {
      if (this.lastAnimation === animation) this.setAnimationIdle();
    };
    this.animatedSprite.play();
    return frames.totalMs;
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

    if (!this.animatedSprite || !this.framesJson) {
      onDeathAction();
      return;
    }

    if (!this.framesJson.dead) {
      this.startDeathPof(onDeathAction);
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

  private startDeathPof(onComplete: () => void): void {
    if (!this.animatedSprite) {
      onComplete();
      return;
    }
    this.animatedSprite.stop();
    this.deathPof = {
      framesRemaining: 15,
      initialScaleX: this.animatedSprite.scale.x,
      initialScaleY: this.animatedSprite.scale.y,
      initialAlpha: this.animatedSprite.alpha,
      onComplete,
    };
  }

  private updateDeathPof(ticker: Ticker): void {
    const pof = this.deathPof;
    if (!pof || !this.animatedSprite) return;

    pof.framesRemaining -= Math.max(1, Math.round(ticker.deltaTime));
    const progress = 1 - Math.max(0, pof.framesRemaining) / 15;
    const scale = 1 - progress * 0.35;
    this.animatedSprite.scale.set(pof.initialScaleX * scale, pof.initialScaleY * scale);
    this.animatedSprite.alpha = pof.initialAlpha * (1 - progress);

    if (pof.framesRemaining > 0) return;
    this.deathPof = undefined;
    pof.onComplete();
  }
  public onTargetAcquired: ((targetId: string) => void) | null = null;
  public onAttackCommitted: ((targetId: string, mode: string) => void) | null = null;
  public onDamageApplied: ((targetId: string, amount: number, hpBefore: number, hpAfter: number) => void) | null = null;

  private isInRange(a: CellCoord, b: CellCoord): boolean {
    return this.model.attackMode === "melee"
      ? Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) <= Math.max(1, this.model.range)
      : Math.hypot(a.col - b.col, a.row - b.row) <= (this.model.range || 0);
  }

  private updateShooting(_time: Ticker) {
    if (this.shootingMode === "disabled" || !this.model.canAttack) return;

    const gridConfig = this.combatGridConfig;
    const unitCell = this.getGridCell();
    if (!gridConfig || !unitCell) return;

    if (this.pendingMeleeAttack) {
      this.setActivity("attacking");
      this.updatePendingMeleeAttack(_time.lastTime, unitCell, gridConfig);
      return;
    }

    const range = this.model.range;
    const targets = this.shootOptions?.targets ?? [];

    if (this.shootingMode === "forced") {
      const target = this.forcedShootingTarget;
      const targetCell = target?.getGridCell(gridConfig);
      this.targetToShoot =
        target?.active &&
        target.canBeProjectileTarget &&
        targetCell &&
        this.isInRange(unitCell, targetCell)
          ? target
          : undefined;
    } else {
      this.targetToShoot = getCurrentOrClosestGridTarget(
        unitCell,
        targets,
        range,
        gridConfig,
        this.targetToShoot,
        this.model.attackMode,
      );
    }

    if (!this.targetToShoot) return;
    this.setActivity("attacking");

    if (this.model.cooldown > 0 && this.lastShotTime > 0) {
      const frameDelta = Math.round(_time.lastTime - this.lastShotTime);
      if (frameDelta < this.model.cooldown) return;
    }

    this.lastShotTime = _time.lastTime;
    this.onTargetAcquired?.(this.targetToShoot.getId());

    const target = this.targetToShoot;
    const targetCell = target.getGridCell(gridConfig);
    if (!targetCell) return;
    const direction = targetCell.col < unitCell.col ? "left" : "right";

    if (this.model.attackMode === "melee") {
      const attackDuration = this.setAnimationAttack(direction);
      if (attackDuration > 0) {
        this.pendingMeleeAttack = {
          target,
          impactAt: _time.lastTime + attackDuration / 2,
          completesAt: _time.lastTime + attackDuration,
          damageApplied: false,
        };
        return;
      }
      this.applyMeleeDamage(target);
      return;
    }

    const shootOptions = this.shootOptions;
    if (!shootOptions?.projectileCreator) return;
    this.setAnimationAttack(direction);
    this.onAttackCommitted?.(target.getId(), "projectile");
    const newProjectile = shootOptions.projectileCreator.get();
    newProjectile.launchAtCell(unitCell, targetCell, gridConfig, target, () => {
      if (target.canBeProjectileTarget) {
        const hpBefore = target.hp;
        target.damage(shootOptions.damage);
        this.onDamageApplied?.(target.getId(), shootOptions.damage, hpBefore, target.hp);
      }
      if (target.isDead() && this.targetToShoot === target) {
        this.targetToShoot = undefined;
      }
    });
  }

  private updatePendingMeleeAttack(time: number, unitCell: CellCoord, gridConfig: GridConfig): void {
    const attack = this.pendingMeleeAttack;
    if (!attack) return;

    if (!attack.damageApplied && time >= attack.impactAt) {
      attack.damageApplied = true;
      const targetCell = attack.target.getGridCell(gridConfig);
      if (
        attack.target.active &&
        attack.target.canBeProjectileTarget &&
        targetCell &&
        this.isInRange(unitCell, targetCell)
      ) {
        this.applyMeleeDamage(attack.target);
      }
    }

    if (time >= attack.completesAt) this.pendingMeleeAttack = undefined;
  }

  private applyMeleeDamage(target: Unit): void {
    const hpBefore = target.hp;
    target.damage(this.model.damage);
    this.onAttackCommitted?.(target.getId(), "melee");
    this.onDamageApplied?.(target.getId(), this.model.damage, hpBefore, target.hp);
    if (target.isDead()) this.targetToShoot = undefined;
  }

  public isDead(): boolean {
    return this.model.state === "dead" || !this.active;
  }

  public spawn(): boolean {
    this.visible = true;
    this.active = true;
    this.canBeProjectileTarget = true;
    this.model.reset();
    this.currentHealth = this.model.hp;
    this.lastAnimation = "idle";
    this.pendingMeleeAttack = undefined;
    this.deathPof = undefined;
    if (this.movement) this.movement.active = true;
    if (this.tileMovement) this.tileMovement.active = true;

    if (!this.animatedSprite) {
      debugLogChanged(this.getId("this.animatedSprite not initialized"));
      this.active = false;
      this.visible = false;
      this.canBeProjectileTarget = false;
      return false;
    }

    this.animatedSprite.visible = true;
    this.animatedSprite.alpha = 1;
    this.animatedSprite.scale.set(1);
    this.animatedSprite.play();

    if (this.targetFollower) {
      this.targetFollower.reset();
      if (this.tileMovement) {
        if (!this.tileMovement.spawn(this)) {
          this.active = false;
          this.visible = false;
          this.canBeProjectileTarget = false;
          this.animatedSprite.visible = false;
          return false;
        }
      } else {
        const origin = this.targetFollower.getOrigin();
        this.position.set(origin.x, origin.y);
      }
    }

    if (this.rangeGraph) {
      this.rangeGraph.visible = false;
    }
    this.selectionIndicator.visible = false;

    if (this.health !== undefined) {
      this.updateHealth();
    }

    return true;
  }

  public destroy() {
    this.currentCommand?.cancel(this);
    this.currentCommand = undefined;
    this.canBeProjectileTarget = false;
    this.model.state = "dead";
    if (this.healthBar) this.healthBar.visible = false;
    this.selectionIndicator.visible = false;
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

  public despawnImmediately(): void {
    this.currentCommand?.cancel(this);
    this.currentCommand = undefined;
    this.canBeProjectileTarget = false;
    this.model.state = "dead";
    if (this.movement) this.movement.active = false;
    if (this.tileMovement) {
      this.tileMovement.active = false;
      this.tileMovement.releaseOccupation();
    }
    this.targetFollower?.clear();
    this.targetToShoot = undefined;
    this.pendingMeleeAttack = undefined;
    this.deathPof = undefined;
    this.shootingMode = "disabled";
    if (this.animatedSprite) {
      this.animatedSprite.stop();
      this.animatedSprite.visible = false;
    }
    this.visible = false;
    this.active = false;
  }

  public damage(amount?: number) {
    this.takeDamage(amount);
  }

  public takeDamage(amount?: number): number {
    if (amount === undefined || amount <= 0 || this.model.state === "dead") return this.model.hp;

    this.currentHealth = this.model.takeDamage(amount);
    if (this.model.hp === 0) this.destroy();
    return this.model.hp;
  }

  public getId(complement?: string): string {
    const base = this.stableId ?? `${this.constructor.name}-${this.uid}`;
    return complement ? `${base}-${complement}` : base;
  }
}

export function getCurrentOrClosestGridTarget(
  position: CellCoord,
  targets: Unit[],
  range: number,
  gridConfig: GridConfig,
  currentTarget: Unit | undefined,
  attackMode: AttackMode = "projectile",
): Unit | undefined {
  const isMelee = attackMode === "melee";
  const effectiveRange = isMelee ? Math.max(1, range) : range;
  const distanceFn = isMelee
    ? (a: CellCoord, b: CellCoord) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
    : getCellDistance;

  let closestTarget: Unit | undefined;
  let closestTargetDistance = Number.POSITIVE_INFINITY;

  if (currentTarget && currentTarget.canBeProjectileTarget) {
    const currentTargetCell = currentTarget.getGridCell(gridConfig);
    if (currentTargetCell && distanceFn(position, currentTargetCell) <= effectiveRange) {
      return currentTarget;
    }
  }

  targets
    .filter((o) => o.canBeProjectileTarget)
    .forEach((target) => {
      if (target.active && target.canBeProjectileTarget) {
        const targetCell = target.getGridCell(gridConfig);
        if (!targetCell) return;
        const currentDistance = distanceFn(position, targetCell);
        if (currentDistance < closestTargetDistance && currentDistance <= effectiveRange) {
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
