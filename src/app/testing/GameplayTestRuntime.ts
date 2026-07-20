import type {
  ApiError,
  ApiResult,
  BeginScenarioOptions,
  BootTestSnapshot,
  CleanupScenarioResult,
  GameTestRuntimePort,
  ObservedCellTestState,
  ScenarioTestSnapshot,
  ScenarioTestState,
  TestEventSnapshot,
} from "./GameTestApi";
import { getTestScenarioDefinition } from "./ScenarioCatalog";

export interface GameplayHarnessBootState {
  ready: boolean;
  surfaceCount: number;
  width: number;
  height: number;
  errors: ApiError[];
}

interface ActiveScenario {
  state: ScenarioTestState;
  snapshot: ScenarioTestSnapshot;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class GameplayTestRuntime implements GameTestRuntimePort {
  private activeScenario: ActiveScenario | null = null;
  private readonly cleanedScenarioIds = new Set<string>();
  private nextScenarioNumber = 1;

  constructor(
    private readonly version: string,
    private readonly getBootState: () => GameplayHarnessBootState,
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
    const snapshot: ScenarioTestSnapshot = {
      scenarioId,
      frame: 0,
      eventSequence: started.sequence,
      economy: clone(definition.economy),
      units: [],
      orders: [],
      cells: this.createCells(definition),
      events: [started],
      wave: null,
      rules: { friendlyFire: options.friendlyFire ?? false },
      errors: [],
    };

    this.activeScenario = { state, snapshot };
    return { ok: true, value: clone(state) };
  }

  getScenarioSnapshot(scenarioId: string): ScenarioTestSnapshot {
    if (!this.activeScenario || this.activeScenario.state.id !== scenarioId) {
      throw new Error(`Test scenario "${scenarioId}" is not active`);
    }
    return clone(this.activeScenario.snapshot);
  }

  cleanupScenario(scenarioId: string): ApiResult<CleanupScenarioResult> {
    if (this.cleanedScenarioIds.has(scenarioId)) return { ok: true, value: this.emptyCleanup() };
    if (!this.activeScenario || this.activeScenario.state.id !== scenarioId) {
      return this.failure("SCENARIO_NOT_FOUND", `Test scenario "${scenarioId}" is not active`);
    }

    const snapshot = this.activeScenario.snapshot;
    const cleanup: CleanupScenarioResult = {
      removedUnitIds: snapshot.units.map((unit) => unit.id),
      remainingTestUnitIds: [],
      leakedOccupations: [],
      pendingOrderIds: [],
      pendingProjectileIds: [],
    };
    this.activeScenario = null;
    this.cleanedScenarioIds.add(scenarioId);
    return { ok: true, value: cleanup };
  }

  private createCells(definition: {
    grid: { columns: number; rows: number };
    cellTypes?: Record<string, string>;
  }): ObservedCellTestState[] {
    const cells: ObservedCellTestState[] = [];
    for (let row = 0; row < definition.grid.rows; row++) {
      for (let col = 0; col < definition.grid.columns; col++) {
        cells.push({
          cell: { col, row },
          type: definition.cellTypes?.[`${col},${row}`] ?? "walkable",
          occupied: false,
          occupantId: null,
        });
      }
    }
    return cells;
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
