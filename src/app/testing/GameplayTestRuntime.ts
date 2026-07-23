import { Container, Ticker } from "pixi.js";
import { createGridConfig, type GridConfig } from "../../grid/GridConfig";
import { GridState } from "../../grid/GridState";
import { getEntityFootprint, getFootprintCellsForPos, isFootprintWalkable } from "../../grid/EntityFootprint";
import { getOccupantCells } from "../../grid/OccupationFootprint";
import {
  PatrolCommand,
  MoveCommand,
  AttackMoveCommand,
  StopCommand,
  HoldPositionCommand,
  type IUnitCommand,
} from "../core/UnitCommands";
import { Enemy, EnemyType } from "../core/unidades/Enemy";
import { Projectile } from "../core/unidades/Projectile";
import { UnitCreator } from "../core/UnitCreator";
import type { CellCoord } from "../../grid/GridConfig";
import type {
  ApiError,
  ApiResult,
  AdvanceTestResult,
  AdvanceTestSimulationOptions,
  BeginScenarioOptions,
  BootTestSnapshot,
  CleanupScenarioResult,
  IssueTestOrderOptions,
  GameTestRuntimePort,
  ObservedCellTestState,
  ScenarioTestSnapshot,
  ScenarioTestState,
  SpawnTestUnitOptions,
  TestEventSnapshot,
  TestOrderSnapshot,
  TestUnitSnapshot,
  TestOrderInput,
  TestUnitTeam,
} from "./GameTestApi";
import {
  getTestScenarioDefinition,
  type TestScenarioStructure,
} from "./ScenarioCatalog";
import { ScenarioVisualHost } from "./ScenarioVisualHost";

export interface GameplayHarnessBootState {
  ready: boolean;
  surfaceCount: number;
  width: number;
  height: number;
  errors: ApiError[];
}

interface ManagedUnit {
  enemy: Enemy;
  id: string;
  archetype: string;
  team: TestUnitTeam;
  previousCell: CellCoord | null;
  patrolEndpoints?: readonly [CellCoord, CellCoord];
  completedCycles: number;
  activeOrderId?: string;
  activeCommand?: IUnitCommand;
  movementMode: TestUnitSnapshot["movement"]["mode"];
  wasBlocked: boolean;
  deathRecorded: boolean;
}

interface ManagedStructure extends TestScenarioStructure {
  nextProductionFrame: number | null;
  producedUnitIds: string[];
}

interface ActiveScenario {
  state: ScenarioTestState;
  container: Container;
  gridConfig: GridConfig;
  gridState: GridState;
  units: ManagedUnit[];
  structures: ManagedStructure[];
  projectileCreator: UnitCreator<Projectile>;
  friendlyFire: boolean;
  frame: number;
  nextSequence: number;
  events: TestEventSnapshot[];
  orders: TestOrderSnapshot[];
  nextOrderNumber: number;
  scenarioId: string;
  preset: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameCell(a: CellCoord, b: CellCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

export class GameplayTestRuntime implements GameTestRuntimePort {
  private activeScenario: ActiveScenario | null = null;
  private readonly cleanedScenarioIds = new Set<string>();
  private nextScenarioNumber = 1;

  constructor(
    private readonly version: string,
    private readonly getBootState: () => GameplayHarnessBootState,
    private readonly visualHost?: ScenarioVisualHost,
  ) {}

  getBootSnapshot(): BootTestSnapshot {
    const boot = this.getBootState();
    if (!boot.ready) throw new Error("Gameplay test harness is not ready");

    return {
      lifecycle: "ready",
      version: this.version,
      renderer: {
        surfaceCount: boot.surfaceCount,
        width: boot.width,
        height: boot.height,
      },
      errors: clone(boot.errors),
    };
  }

  beginScenario(options: BeginScenarioOptions): ApiResult<ScenarioTestState> {
    if (this.activeScenario) {
      return this.failure("SCENARIO_ACTIVE", "A test scenario is already active", {
        scenarioId: this.activeScenario.state.id,
      });
    }

    const definition = getTestScenarioDefinition(options.preset);
    if (!definition) {
      return this.failure(
        "SCENARIO_NOT_IMPLEMENTED",
        `Scenario "${options.preset}" is not implemented`,
      );
    }

    const scenarioId = `scenario-${this.nextScenarioNumber++}-${definition.preset}`;
    const gridConfig: GridConfig = createGridConfig({
      gridWidth: definition.grid.columns,
      gridHeight: definition.grid.rows,
      cellSize: definition.grid.tileSize,
    });
    const gridState = new GridState(gridConfig);
    for (const [key, type] of Object.entries(definition.cellTypes ?? {})) {
      const [col, row] = key.split(",").map(Number);
      const cell = gridState.getCell({ col, row });
      if (cell) gridState.setCell({ col, row }, { ...cell, type });
    }

    const structures: ManagedStructure[] = (definition.structures ?? []).map((structure) => ({
      ...clone(structure),
      nextProductionFrame: structure.production ? 1 : null,
      producedUnitIds: [],
    }));
    for (const structure of structures) {
      const cells = getFootprintCellsForPos(
        structure.cell,
        structure.footprint.width,
        structure.footprint.height,
      );
      for (const c of cells) {
        gridState.occupyCell(c, `structure:${structure.id}`);
      }
    }

    const state: ScenarioTestState = {
      id: scenarioId,
      preset: definition.preset,
      simulation: "manual",
      frame: 0,
      grid: clone(definition.grid),
      landmarks: clone(definition.landmarks),
      groups: clone(definition.groups),
      path: clone(definition.path),
    };

    const started: TestEventSnapshot = {
      sequence: 1,
      frame: 0,
      scenarioId,
      type: "scenario.started",
    };

    const unitContainer = new Container();
    unitContainer.label = "test-units";

    const projectileCreator = new UnitCreator<Projectile>({
      container: unitContainer,
      initialPoolSize: 0,
      factory: () => new Projectile(unitContainer),
    });

    this.activeScenario = {
      state,
      container: unitContainer,
      gridConfig,
      gridState,
      units: [],
      structures,
      projectileCreator,
      friendlyFire: options.friendlyFire ?? false,
      frame: 0,
      nextSequence: 2,
      events: [started],
      orders: [],
      nextOrderNumber: 1,
      scenarioId,
      preset: definition.preset,
    };

    this.visualHost?.mount(gridConfig, unitContainer);
    this.visualHost?.updateGrid(gridState);

    return { ok: true, value: clone(state) };
  }

  spawnTestUnit(options: SpawnTestUnitOptions): ApiResult<TestUnitSnapshot> {
    const scenario = this.requireScenario(options.scenarioId);
    if (!scenario) {
      return this.failure("SCENARIO_NOT_FOUND", `Test scenario "${options.scenarioId}" is not active`);
    }

    if (scenario.units.some((u) => u.id === options.id)) {
      return this.failure("UNIT_ID_CONFLICT", `Unit "${options.id}" already exists`);
    }

    const spawnCell = this.resolveSpawnCell(scenario, options.cell, options.archetype);
    if (!spawnCell) {
      return this.failure(
        "SPAWN_CELL_OCCUPIED",
        `Cell (${options.cell.col}, ${options.cell.row}) is occupied and no free cell found nearby`,
      );
    }
    const finalCell: CellCoord = spawnCell;

    const ARCHETYPE_TO_ENEMY: Record<string, EnemyType> = {
      goblin: EnemyType.Goblin,
      skeleton: EnemyType.Skeleton,
      ghost: EnemyType.Ghost,
      warrior: EnemyType.Warrior,
    };
    const enemy = new Enemy(scenario.container, { id: options.id });
    enemy.initializeEnemy(ARCHETYPE_TO_ENEMY[options.archetype] ?? EnemyType.Goblin);
    if (options.archetype === "warrior") enemy.scale.set(1 / 3);
    enemy.team = options.team;

    const hasCombat = options.stats && (options.stats.damage ?? 0) > 0;
    const attackMode = options.stats?.rangeCells && options.stats.rangeCells > 1 ? "projectile" : "melee";

    if (options.stats) {
      if (options.stats.movementFramesPerCell !== undefined) {
        enemy.initializeSpeed(scenario.gridConfig.cellSize / options.stats.movementFramesPerCell);
      }
      if (options.stats.hp !== undefined) {
        enemy.initializeHealthBar(options.stats.hp);
      }
      if (hasCombat) {
        enemy.model.configure({
          damage: options.stats.damage,
          range: options.stats.rangeCells ?? 1,
          vision: options.stats.visionCells,
          attackMode,
          cooldown: ((options.stats.fireCooldownFrames ?? 1) * 1000) / 60,
        });
      }
    }

    enemy.initializeTileMovement({
      cells: [],
      gridConfig: scenario.gridConfig,
      gridState: scenario.gridState,
      start: finalCell,
      entityType: options.archetype,
      ...(options.stats?.movementFramesPerCell !== undefined
        ? { ticksPerCell: options.stats.movementFramesPerCell }
        : {}),
    });

    if (hasCombat) {
      enemy.initializeShootingRange({
        range: options.stats!.rangeCells ?? 1,
        fireRate: (options.stats!.fireCooldownFrames ?? 1) / 60,
        projectileCreator: scenario.projectileCreator,
        damage: options.stats!.damage!,
        targets: [],
      });
    }

    enemy.onTargetAcquired = (targetId) => {
      scenario.events.push({
        sequence: scenario.nextSequence++,
        frame: scenario.frame,
        scenarioId: scenario.scenarioId,
        type: "target.acquired",
        unitId: options.id,
        targetId,
      });
    };
    enemy.onAttackCommitted = (targetId, mode) => {
      scenario.events.push({
        sequence: scenario.nextSequence++,
        frame: scenario.frame,
        scenarioId: scenario.scenarioId,
        type: "attack.committed",
        unitId: options.id,
        targetId,
        reason: mode,
      });
    };
    enemy.onDamageApplied = (targetId, amount, hpBefore, hpAfter) => {
      scenario.events.push({
        sequence: scenario.nextSequence++,
        frame: scenario.frame,
        scenarioId: scenario.scenarioId,
        type: "damage.applied",
        sourceId: options.id,
        targetId,
        amount,
        hpBefore,
        hpAfter,
      });
    };

    if (!enemy.spawn()) {
      return this.failure(
        "SPAWN_OCCUPATION_FAILED",
        `Unit "${options.id}" could not occupy cell (${finalCell.col}, ${finalCell.row})`,
      );
    }

    const managed: ManagedUnit = {
      enemy,
      id: options.id,
      archetype: options.archetype,
      team: options.team,
      previousCell: { ...finalCell },
      completedCycles: 0,
      movementMode: "idle",
      wasBlocked: false,
      deathRecorded: false,
    };
    scenario.units.push(managed);

    this.refreshTargets(scenario);

    this.visualHost?.updateGrid(scenario.gridState);

    const snapshot = this.buildUnitSnapshot(managed, scenario);
    return { ok: true, value: snapshot };
  }

  issueTestOrder(options: IssueTestOrderOptions): ApiResult<TestOrderSnapshot> {
    const scenario = this.requireScenarioForUnit(options.unitId);
    if (!scenario) {
      return this.failure("SCENARIO_NOT_FOUND", `Unit "${options.unitId}" has no active scenario`);
    }

    const unit = scenario.units.find((u) => u.id === options.unitId);
    if (!unit) {
      return this.failure("UNIT_NOT_FOUND", `Unit "${options.unitId}" not found`);
    }

    const command = this.createCommand(options.order);
    if (!command) {
      return this.failure("INVALID_ORDER", `Unsupported order type: ${options.order.type}`);
    }

    this.cancelActiveOrder(scenario, unit);
    unit.enemy.issueCommand(command);

    if (options.order.type === "patrol") {
      unit.patrolEndpoints = options.order.endpoints;
      unit.completedCycles = 0;
    }

    const snapshot = this.createOrderSnapshot(scenario, unit, options.order, command);
    scenario.orders.push(snapshot);
    this.recordMoveResolution(scenario, snapshot, command);
    unit.movementMode = movementModeFor(options.order.type);

    if (snapshot.status === "running") {
      unit.activeOrderId = snapshot.id;
      unit.activeCommand = command;
    }

    return { ok: true, value: clone(snapshot) };
  }

  getScenarioSnapshot(scenarioId: string): ScenarioTestSnapshot {
    if (!this.activeScenario || this.activeScenario.scenarioId !== scenarioId) {
      throw new Error(`Test scenario "${scenarioId}" is not active`);
    }
    return this.buildSnapshot(undefined);
  }

  advanceTestSimulation(options: AdvanceTestSimulationOptions): ApiResult<AdvanceTestResult> {
    const scenario = this.requireScenario(options.scenarioId);
    if (!scenario) {
      return this.failure("SCENARIO_NOT_FOUND", `Test scenario "${options.scenarioId}" is not active`);
    }

    let elapsedFrames = 0;
    const maxFrames = options.maxFrames;
    let matchedEvent: TestEventSnapshot | undefined;

    while (elapsedFrames < maxFrames) {
      this.tickOneFrame(scenario);
      elapsedFrames++;

      const snapshot = this.buildSnapshot(options.afterSequence);

      matchedEvent = this.findMatchingEvent(snapshot.events, options.condition);
      if (matchedEvent) break;
    }

    if (!matchedEvent) {
      const snapshot = this.buildSnapshot(options.afterSequence);
      return this.failure(
        "CONDITION_NOT_MET",
        `Condition not met after ${elapsedFrames} frames (max: ${maxFrames})`,
        {
          elapsedFrames,
          condition: options.condition,
          units: snapshot.units.map((unit) => ({
            id: unit.id,
            cell: unit.cell,
            targetCell: unit.movement.targetCell,
            stepProgress: unit.movement.stepProgress,
            transitions: snapshot.events.filter(
              (event) => event.type === "unit.entered-cell" && event.unitId === unit.id,
            ).length,
            blocked: snapshot.events.filter(
              (event) => event.type === "movement.blocked" && event.unitId === unit.id,
            ).length,
            resumed: snapshot.events.filter(
              (event) => event.type === "movement.resumed" && event.unitId === unit.id,
            ).length,
          })),
        },
      );
    }

    return {
      ok: true,
      value: {
        elapsedFrames,
        matchedEvent,
        snapshot: this.buildSnapshot(options.afterSequence),
      },
    };
  }

  advanceTestFrames(scenarioId: string, frames: number): ApiResult<ScenarioTestSnapshot> {
    const scenario = this.requireScenario(scenarioId);
    if (!scenario) {
      return this.failure("SCENARIO_NOT_FOUND", `Test scenario "${scenarioId}" is not active`);
    }

    for (let i = 0; i < frames; i++) {
      this.tickOneFrame(scenario);
    }

    return { ok: true, value: this.buildSnapshot(undefined) };
  }

  cleanupScenario(scenarioId: string): ApiResult<CleanupScenarioResult> {
    if (this.cleanedScenarioIds.has(scenarioId)) {
      return { ok: true, value: this.emptyCleanup() };
    }

    if (!this.activeScenario || this.activeScenario.scenarioId !== scenarioId) {
      return this.failure("SCENARIO_NOT_FOUND", `Test scenario "${scenarioId}" is not active`);
    }

    const removedUnitIds: string[] = [];
    const leakedCells: ObservedCellTestState[] = [];
    const pendingOrderIds: string[] = [];

    for (const unit of this.activeScenario.units) {
      removedUnitIds.push(unit.id);

      unit.enemy.despawnImmediately();

      if (unit.enemy.currentCommand) {
        pendingOrderIds.push(unit.id);
      }
    }

    for (let row = 0; row < this.activeScenario.gridConfig.gridHeight; row++) {
      for (let col = 0; col < this.activeScenario.gridConfig.gridWidth; col++) {
        const cell = this.activeScenario.gridState.getCell({ col, row });
        if (cell?.occupantId?.startsWith("structure:")) {
          this.activeScenario.gridState.liberateCell({ col, row });
        }
      }
    }

    for (let row = 0; row < this.activeScenario.gridConfig.gridHeight; row++) {
      for (let col = 0; col < this.activeScenario.gridConfig.gridWidth; col++) {
        const cell = this.activeScenario.gridState.getCell({ col, row });
        if (cell?.occupied) {
          leakedCells.push({
            cell: { col, row },
            type: cell.type,
            occupied: true,
            occupantId: cell.occupantId ?? null,
          });
        }
      }
    }

    this.visualHost?.unmount();
    this.activeScenario = null;
    this.cleanedScenarioIds.add(scenarioId);

    return {
      ok: true,
      value: {
        removedUnitIds,
        remainingTestUnitIds: [],
        leakedOccupations: leakedCells,
        pendingOrderIds,
        pendingProjectileIds: [],
      },
    };
  }

  getActiveScenarioId(): string | null {
    return this.activeScenario?.scenarioId ?? null;
  }

  getActiveScenarioSnapshot(): ScenarioTestSnapshot {
    if (!this.activeScenario) throw new Error("No active scenario");
    return this.buildSnapshot(undefined);
  }

  // ── Private ──

  /** Busca la celda solicitada; si está ocupada, hace BFS por la celda libre más cercana */
  private resolveSpawnCell(
    scenario: ActiveScenario,
    requested: CellCoord,
    archetype: string,
  ): CellCoord | null {
    const { gridConfig, gridState } = scenario;
    const footprint = getEntityFootprint(archetype);
    const isFree = (anchor: CellCoord): boolean => {
      const cells = getFootprintCellsForPos(anchor, footprint.width, footprint.height);
      return cells.every((c) => {
        if (c.col < 0 || c.col >= gridConfig.gridWidth) return false;
        if (c.row < 0 || c.row >= gridConfig.gridHeight) return false;
        const cell = gridState.getCell(c);
        return Boolean(cell && cell.type !== "blocked" && !cell.occupied);
      });
    };

    if (isFree(requested)) return requested;

    const visited = new Set<string>();
    const key = (c: CellCoord) => `${c.col},${c.row}`;
    const queue: CellCoord[] = [requested];
    visited.add(key(requested));

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const next: CellCoord = { col: current.col + dc, row: current.row + dr };
        const k = key(next);
        if (visited.has(k)) continue;
        visited.add(k);
        if (
          next.col < 0 || next.col >= gridConfig.gridWidth ||
          next.row < 0 || next.row >= gridConfig.gridHeight
        ) continue;
        if (isFree(next)) return next;
        queue.push(next);
      }
    }

    return null;
  }

  private requireScenario(scenarioId: string): ActiveScenario | null {
    if (!this.activeScenario || this.activeScenario.scenarioId !== scenarioId) return null;
    return this.activeScenario;
  }

  private requireScenarioForUnit(unitId: string): ActiveScenario | null {
    if (!this.activeScenario) return null;
    const found = this.activeScenario.units.some((u) => u.id === unitId);
    return found ? this.activeScenario : null;
  }

  private createCommand(
    order: TestOrderInput,
  ): import("../core/UnitCommands").IUnitCommand | null {
    switch (order.type) {
      case "patrol": {
        const [start, end] = order.endpoints;
        return new PatrolCommand([{ ...start }, { ...end }]);
      }
      case "move":
        return new MoveCommand({ ...order.destination });
      case "attack-move":
        return new AttackMoveCommand({ ...order.destination });
      case "stop":
        return new StopCommand();
      case "hold-position":
        return new HoldPositionCommand();
      case "attack":
        return null;
      default:
        return null;
    }
  }

  private tickOneFrame(scenario: ActiveScenario): void {
    scenario.frame++;
    this.produceUnits(scenario);

    for (const unit of scenario.units) {
      unit.previousCell = unit.enemy.getGridCell(scenario.gridConfig)
        ? { ...unit.enemy.getGridCell(scenario.gridConfig)! }
        : null;
    }

    const ticker = {
      deltaTime: 1,
      lastTime: scenario.frame * 16.667,
      elapsedMS: 16.667,
    } as unknown as Ticker;

    this.refreshTargets(scenario);

    for (const unit of scenario.units) {
      if (unit.enemy.active && unit.enemy.animatedSprite?.visible !== false) {
        unit.enemy.update(ticker);
      }
      if (unit.enemy.isDead() && !unit.deathRecorded) {
        scenario.events.push({
          sequence: scenario.nextSequence++,
          frame: scenario.frame,
          scenarioId: scenario.scenarioId,
          type: "unit.died",
          unitId: unit.id,
        });
        unit.deathRecorded = true;
      }
      const movement = unit.enemy.getLastCommandMovementResult();
      if (movement?.blocked && !unit.wasBlocked) {
        scenario.events.push({
          sequence: scenario.nextSequence++,
          frame: scenario.frame,
          scenarioId: scenario.scenarioId,
          type: "movement.blocked",
          unitId: unit.id,
        });
      } else if (movement && !movement.blocked && unit.wasBlocked) {
        scenario.events.push({
          sequence: scenario.nextSequence++,
          frame: scenario.frame,
          scenarioId: scenario.scenarioId,
          type: "movement.resumed",
          unitId: unit.id,
        });
      }
      unit.wasBlocked = movement?.blocked ?? false;
      this.syncActiveOrder(scenario, unit);
    }

    scenario.projectileCreator.update(ticker);

    this.visualHost?.updateGrid(scenario.gridState);

    for (const unit of scenario.units) {
      const currentCell = unit.enemy.getGridCell(scenario.gridConfig);

      if (currentCell && unit.previousCell && !sameCell(currentCell, unit.previousCell)) {
        scenario.events.push({
          sequence: scenario.nextSequence++,
          frame: scenario.frame,
          scenarioId: scenario.scenarioId,
          type: "unit.entered-cell",
          unitId: unit.id,
          from: { ...unit.previousCell },
          to: { ...currentCell },
        });

        const ep = unit.patrolEndpoints;
        if (
          ep &&
          sameCell(currentCell, ep[0]) &&
          !sameCell(unit.previousCell, ep[0])
        ) {
          unit.completedCycles++;
          const order = scenario.orders.find((candidate) => candidate.id === unit.activeOrderId);
          if (order) order.completedCycles = unit.completedCycles;
        }
      }

      if (unit.previousCell === null && currentCell) {
        scenario.events.push({
          sequence: scenario.nextSequence++,
          frame: scenario.frame,
          scenarioId: scenario.scenarioId,
          type: "unit.spawned",
          unitId: unit.id,
          to: { ...currentCell },
        });
      }
    }
  }

  private produceUnits(scenario: ActiveScenario): void {
    for (const structure of scenario.structures) {
      const production = structure.production;
      if (!production || structure.nextProductionFrame === null) continue;
      if (scenario.frame < structure.nextProductionFrame) continue;

      structure.nextProductionFrame = scenario.frame + production.intervalFrames;
      const unitId = `${structure.id}-unit-${structure.producedUnitIds.length + 1}`;
      const cell = this.findFreeAdjacentCell(scenario, structure, production.archetype);
      if (!cell) {
        scenario.events.push({
          sequence: scenario.nextSequence++,
          frame: scenario.frame,
          scenarioId: scenario.scenarioId,
          type: "production.blocked",
          sourceId: structure.id,
          reason: "no-adjacent-cell-free",
        });
        continue;
      }

      const result = this.spawnTestUnit({
        scenarioId: scenario.scenarioId,
        id: unitId,
        archetype: production.archetype,
        team: production.team,
        cell,
      });
      if (!result.ok) {
        scenario.events.push({
          sequence: scenario.nextSequence++,
          frame: scenario.frame,
          scenarioId: scenario.scenarioId,
          type: "production.blocked",
          sourceId: structure.id,
          reason: result.error.code,
        });
        continue;
      }

      structure.producedUnitIds.push(unitId);
      scenario.events.push({
        sequence: scenario.nextSequence++,
        frame: scenario.frame,
        scenarioId: scenario.scenarioId,
        type: "unit.produced",
        sourceId: structure.id,
        unitId,
        to: { ...cell },
      });
    }
  }

  private findFreeAdjacentCell(
    scenario: ActiveScenario,
    structure: ManagedStructure,
    archetype: string,
  ): CellCoord | undefined {
    const footprint = getEntityFootprint(archetype);
    const minCol = structure.cell.col - 1;
    const minRow = structure.cell.row - 1;
    const maxCol = structure.cell.col + structure.footprint.width;
    const maxRow = structure.cell.row + structure.footprint.height;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const inside = col >= structure.cell.col &&
          col < structure.cell.col + structure.footprint.width &&
          row >= structure.cell.row &&
          row < structure.cell.row + structure.footprint.height;
        if (inside) continue;

        const cell = { col, row };
        if (
          isFootprintWalkable(
            cell,
            footprint.width,
            footprint.height,
            scenario.gridState,
            scenario.gridConfig,
          )
        ) {
          return cell;
        }
      }
    }

    return undefined;
  }

  private findMatchingEvent(
    events: TestEventSnapshot[],
    condition: AdvanceTestSimulationOptions["condition"],
  ): TestEventSnapshot | undefined {
    if (condition.type === "all-units-progressed") {
      const progressed = condition.unitIds.every((unitId) => {
        return events.filter((event) => event.type === "unit.entered-cell" && event.unitId === unitId)
          .length >= condition.minimumTransitions;
      });
      const recovered = condition.unitIds.every((unitId) => {
        const unit = this.activeScenario?.units.find((candidate) => candidate.id === unitId);
        const blocked = events.filter(
          (event) => event.type === "movement.blocked" && event.unitId === unitId,
        ).length;
        const resumed = events.filter(
          (event) => event.type === "movement.resumed" && event.unitId === unitId,
        ).length;
        return !unit?.wasBlocked && resumed >= blocked;
      });
      return progressed && recovered ? events[events.length - 1] : undefined;
    }

    return events.find((ev) => {
      switch (condition.type) {
        case "event":
          return ev.type === condition.eventType;
        case "unit-entered-cell":
          return (
            ev.type === "unit.entered-cell" &&
            ev.unitId === condition.unitId &&
            (!condition.cell || (ev.to && sameCell(ev.to, condition.cell)))
          );
        default:
          return false;
      }
    });
  }

  private buildSnapshot(afterSequence: number | undefined): ScenarioTestSnapshot {
    if (!this.activeScenario) throw new Error("No active scenario");
    const scenario = this.activeScenario;

    const units = scenario.units.map((unit) => this.buildUnitSnapshot(unit, scenario));

    const cells: ObservedCellTestState[] = [];
    for (let row = 0; row < scenario.gridConfig.gridHeight; row++) {
      for (let col = 0; col < scenario.gridConfig.gridWidth; col++) {
        const cell = scenario.gridState.getCell({ col, row });
        cells.push({
          cell: { col, row },
          type: cell?.type ?? "walkable",
          occupied: cell?.occupied ?? false,
          occupantId: cell?.occupantId ?? null,
        });
      }
    }

    const filteredEvents = afterSequence !== undefined
      ? scenario.events.filter((ev) => ev.sequence > afterSequence)
      : scenario.events;

    return {
      scenarioId: scenario.scenarioId,
      frame: scenario.frame,
      eventSequence: filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1].sequence : 0,
      economy: { coins: 0 },
      units,
      orders: clone(scenario.orders),
      cells,
      events: clone(filteredEvents),
      wave: null,
      rules: { friendlyFire: false },
      errors: [],
    };
  }

  private buildUnitSnapshot(
    unit: ManagedUnit,
    scenario: ActiveScenario,
  ): TestUnitSnapshot {
    const { gridConfig, gridState } = scenario;
    const cell = unit.enemy.getGridCell(gridConfig);
    const movementState = unit.enemy.getCommandMovementState();
    const cellCoord = cell ?? null;
    const activeOrder = unit.activeOrderId
      ? scenario.orders.find((order) => order.id === unit.activeOrderId) ?? null
      : null;
    const unitId = unit.enemy.getId();

    return {
      id: unit.id,
      archetype: unit.archetype,
      team: unit.team,
      lifecycle: unit.enemy.isDead() ? "dead" : "alive",
      active: unit.enemy.active,
      cell: cellCoord,
      world: { x: unit.enemy.position.x, y: unit.enemy.position.y },
      occupiedCells: getOccupantCells(unitId, gridState, gridConfig),
      hp: unit.enemy.hp,
      maxHp: unit.enemy.maxHp,
      movement: {
        mode: unit.movementMode,
        route: movementState.route,
        targetCell: movementState.targetCell,
        stepProgress: movementState.stepProgress,
      },
      activity: unit.enemy.activity,
      combat: {
        mode: unit.enemy.getShootingMode(),
        targetId: unit.enemy.targetToShoot?.getId() ?? null,
        damage: unit.enemy.attackDamage,
        rangeCells: unit.enemy.range,
        visionCells: unit.enemy.vision,
      },
      order: activeOrder ? clone(activeOrder) : null,
    };
  }

  private createOrderSnapshot(
    scenario: ActiveScenario,
    unit: ManagedUnit,
    input: TestOrderInput,
    command: IUnitCommand,
  ): TestOrderSnapshot {
    const order: TestOrderSnapshot = {
      id: `${unit.id}-order-${scenario.nextOrderNumber++}`,
      unitId: unit.id,
      type: mapCommandType(command.type),
      status: command.status,
      issuedAtFrame: scenario.frame,
      finishedAtFrame: command.status === "running" ? null : scenario.frame,
    };

    switch (input.type) {
      case "move":
      case "attack-move":
        order.destination = { ...input.destination };
        if (command instanceof MoveCommand || command instanceof AttackMoveCommand) {
          const resolvedDestination = command.getResolvedDestination();
          if (resolvedDestination) order.resolvedDestination = resolvedDestination;
          const completionReason = command.getCompletionReason();
          if (completionReason) order.completionReason = completionReason;
        }
        break;
      case "patrol":
        order.endpoints = [{ ...input.endpoints[0] }, { ...input.endpoints[1] }];
        order.completedCycles = unit.completedCycles;
        break;
      case "attack":
        order.targetId = input.targetId;
        break;
    }

    return order;
  }

  private cancelActiveOrder(scenario: ActiveScenario, unit: ManagedUnit): void {
    if (!unit.activeOrderId) return;
    const order = scenario.orders.find((candidate) => candidate.id === unit.activeOrderId);
    if (order?.status === "running") {
      order.status = "cancelled";
      order.finishedAtFrame = scenario.frame;
    }
    unit.activeOrderId = undefined;
    unit.activeCommand = undefined;
  }

  private syncActiveOrder(scenario: ActiveScenario, unit: ManagedUnit): void {
    if (!unit.activeOrderId || !unit.activeCommand) return;
    if (unit.activeCommand.status === "running") return;

    const order = scenario.orders.find((candidate) => candidate.id === unit.activeOrderId);
    if (order) {
      this.recordMoveResolution(scenario, order, unit.activeCommand);
      order.status = unit.activeCommand.status;
      order.finishedAtFrame = scenario.frame;
    }
    unit.activeOrderId = undefined;
    unit.activeCommand = undefined;
    unit.movementMode = "idle";
  }

  private recordMoveResolution(
    scenario: ActiveScenario,
    order: TestOrderSnapshot,
    command: IUnitCommand,
  ): void {
    if (!(command instanceof MoveCommand || command instanceof AttackMoveCommand)) return;

    const resolvedDestination = command.getResolvedDestination();
    if (resolvedDestination) order.resolvedDestination = resolvedDestination;
    const completionReason = command.getCompletionReason();
    if (completionReason) order.completionReason = completionReason;

    if (
      completionReason === "fallback-reached" &&
      order.destination &&
      resolvedDestination &&
      !sameCell(order.destination, resolvedDestination) &&
      !scenario.events.some((event) => event.orderId === order.id && event.type === "movement.destination-adjusted")
    ) {
      scenario.events.push({
        sequence: scenario.nextSequence++,
        frame: scenario.frame,
        scenarioId: scenario.scenarioId,
        type: "movement.destination-adjusted",
        unitId: order.unitId,
        orderId: order.id,
        from: { ...order.destination },
        to: { ...resolvedDestination },
        reason: completionReason,
      });
    }
  }

  private refreshTargets(scenario: ActiveScenario): void {
    const activeUnits = scenario.units.filter(
      (u) => u.enemy.active && !u.enemy.isDead() && u.enemy.canBeProjectileTarget,
    );

    for (const unit of scenario.units) {
      const enemy = unit.enemy;
      if (!enemy.model.canAttack || !enemy.active || enemy.isDead()) continue;

      const targets = activeUnits.filter(
        (other) =>
          other.id !== unit.id &&
          enemy.isHostileTo(other.enemy) &&
          (!scenario.friendlyFire || (unit.team !== other.team)),
      );

      enemy.setShootingTargets(targets.map((t) => t.enemy));
    }
  }

  private emptyCleanup(): CleanupScenarioResult {
    return {
      removedUnitIds: [],
      remainingTestUnitIds: [],
      leakedOccupations: [],
      pendingOrderIds: [],
      pendingProjectileIds: [],
    };
  }

  private failure<T>(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): ApiResult<T> {
    return { ok: false, error: { code, message, details } };
  }
}

function mapCommandType(type: string): import("./GameTestApi").TestOrderType {
  switch (type) {
    case "hold":
      return "hold-position";
    case "move":
    case "attack-move":
    case "stop":
    case "patrol":
    case "attack":
      return type;
    default:
      return "stop";
  }
}

function movementModeFor(type: TestOrderInput["type"]): TestUnitSnapshot["movement"]["mode"] {
  switch (type) {
    case "move":
    case "attack-move":
      return "moving";
    case "stop":
      return "stopped";
    case "hold-position":
      return "holding";
    case "patrol":
      return "patrolling";
    case "attack":
      return "idle";
  }
}
