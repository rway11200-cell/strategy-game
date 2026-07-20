import { Container, Ticker } from "pixi.js";
import { createGridConfig, type GridConfig } from "../../grid/GridConfig";
import { GridState } from "../../grid/GridState";
import {
  PatrolCommand,
  MoveCommand,
  StopCommand,
  HoldPositionCommand,
} from "../core/UnitCommands";
import { Enemy, EnemyType } from "../core/unidades/Enemy";
import type { CellCoord } from "../../grid/GridConfig";
import { gridToWorld } from "../../grid/GridConfig";
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
} from "./GameTestApi";
import { getTestScenarioDefinition } from "./ScenarioCatalog";
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
  previousCell: CellCoord | null;
  patrolEndpoints?: readonly [CellCoord, CellCoord];
  completedCycles: number;
}

interface ActiveScenario {
  state: ScenarioTestState;
  container: Container;
  gridConfig: GridConfig;
  gridState: GridState;
  units: ManagedUnit[];
  frame: number;
  nextSequence: number;
  events: TestEventSnapshot[];
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

    this.activeScenario = {
      state,
      container: unitContainer,
      gridConfig,
      gridState,
      units: [],
      frame: 0,
      nextSequence: 2,
      events: [started],
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

    const enemy = new Enemy(scenario.container, { id: options.id });
    enemy.initializeEnemy(EnemyType.Goblin);

    if (options.stats) {
      if (options.stats.movementFramesPerCell !== undefined) {
        enemy.initializeSpeed(scenario.gridConfig.cellSize / options.stats.movementFramesPerCell);
      }
      if (options.stats.hp !== undefined) {
        enemy.initializeHealthBar(options.stats.hp);
      }
    }

    enemy.initializeTileMovement({
      cells: [options.cell],
      gridConfig: scenario.gridConfig,
      gridState: scenario.gridState,
      start: options.cell,
      entityType: "enemy",
      ticksPerCell: options.stats?.movementFramesPerCell ?? 1,
    });

    enemy.spawn();

    const managed: ManagedUnit = {
      enemy,
      id: options.id,
      previousCell: { ...options.cell },
      completedCycles: 0,
    };
    scenario.units.push(managed);

    this.visualHost?.updateGrid(scenario.gridState);

    const snapshot = this.buildUnitSnapshot(managed, options.archetype, options.team, scenario.gridConfig);
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

    unit.enemy.issueCommand(command);

    if (options.order.type === "patrol") {
      unit.patrolEndpoints = options.order.endpoints;
      unit.completedCycles = 0;
    }

    const snapshot = this.buildOrderSnapshot(unit, options.order);
    return { ok: true, value: snapshot };
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
      return this.failure(
        "CONDITION_NOT_MET",
        `Condition not met after ${elapsedFrames} frames (max: ${maxFrames})`,
        { elapsedFrames, condition: options.condition },
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

  // ── Private ──

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

    for (const unit of scenario.units) {
      if (unit.enemy.active && unit.enemy.animatedSprite?.visible !== false) {
        unit.enemy.update(ticker);
      }
    }

    this.visualHost?.updateGrid(scenario.gridState);

    for (const unit of scenario.units) {
      const currentCell = unit.enemy.getGridCell(scenario.gridConfig);

      if (currentCell && unit.previousCell && !sameCell(currentCell, unit.previousCell)) {
        scenario.events.push({
          sequence: scenario.nextSequence++,
          frame: scenario.frame,
          scenarioId: scenario.scenarioId,
          type: "unit.enteredCell",
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

  private findMatchingEvent(
    events: TestEventSnapshot[],
    condition: AdvanceTestSimulationOptions["condition"],
  ): TestEventSnapshot | undefined {
    return events.find((ev) => {
      switch (condition.type) {
        case "event":
          return ev.type === condition.eventType;
        case "unit-entered-cell":
          return (
            ev.type === "unit.enteredCell" &&
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

    const units = scenario.units.map((u) =>
      this.buildUnitSnapshot(u, u.enemy.enemyType ?? "goblin", "enemy", scenario.gridConfig),
    );

    const orders = scenario.units
      .filter((u) => u.enemy.currentCommand)
      .map((u) => {
        const cmd = u.enemy.currentCommand!;
        const snapshot: TestOrderSnapshot = {
          id: u.id,
          unitId: u.id,
          type: mapCommandType(cmd.type),
          status: cmd.status,
          issuedAtFrame: 0,
          finishedAtFrame: null,
        };
        if (cmd instanceof PatrolCommand) {
          snapshot.completedCycles = u.completedCycles;
        }
        return snapshot;
      });

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
      orders,
      cells,
      events: clone(filteredEvents),
      wave: null,
      rules: { friendlyFire: false },
      errors: [],
    };
  }

  private buildUnitSnapshot(
    unit: ManagedUnit,
    archetype: string,
    team: string,
    gridConfig: GridConfig,
  ): TestUnitSnapshot {
    const cell = unit.enemy.getGridCell(gridConfig);
    const movementState = unit.enemy.getCommandMovementState();
    const cellCoord = cell ?? null;

    return {
      id: unit.id,
      archetype,
      team: team as "enemy",
      lifecycle: "alive",
      active: unit.enemy.active,
      cell: cellCoord,
      world: cellCoord
        ? gridToWorld(cellCoord.col, cellCoord.row, gridConfig)
        : { x: unit.enemy.position.x, y: unit.enemy.position.y },
      occupiedCells: cellCoord ? [cellCoord] : [],
      hp: unit.enemy.hp,
      maxHp: unit.enemy.maxHp,
      movement: {
        mode: unit.enemy.currentCommand ? "patrolling" : "idle",
        route: movementState.route,
        targetCell: movementState.targetCell,
        stepProgress: movementState.stepProgress,
      },
      combat: {
        mode: unit.enemy.getShootingMode(),
        targetId: null,
        damage: unit.enemy.attackDamage,
        rangeCells: unit.enemy.range,
      },
      order: unit.enemy.currentCommand
        ? {
            id: unit.id,
            unitId: unit.id,
            type: mapCommandType(unit.enemy.currentCommand.type),
            status: unit.enemy.currentCommand.status,
            issuedAtFrame: 0,
            finishedAtFrame: null,
            completedCycles: unit.enemy.currentCommand instanceof PatrolCommand
              ? unit.completedCycles
              : undefined,
          }
        : null,
    };
  }

  private buildOrderSnapshot(
    unit: ManagedUnit,
    _input: TestOrderInput,
  ): TestOrderSnapshot {
    const cmd = unit.enemy.currentCommand!;
    const order: TestOrderSnapshot = {
      id: unit.id,
      unitId: unit.id,
      type: mapCommandType(cmd.type),
      status: cmd.status,
      issuedAtFrame: this.activeScenario?.frame ?? 0,
      finishedAtFrame: null,
    };

    if (cmd instanceof PatrolCommand) {
      order.endpoints = [cmd.cells[0], cmd.cells[1]] as const;
      order.completedCycles = unit.completedCycles;
    }

    return order;
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
    case "stop":
    case "patrol":
    case "attack":
      return type;
    default:
      return "stop";
  }
}
