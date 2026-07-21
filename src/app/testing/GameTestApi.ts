/// <reference types="vite/client" />

/**
 * GameTestApi — API de testing para validación automática del juego.
 *
 * Expuesta globalmente como window.__GAME_TEST__ para que
 * Playwright, Hermes u otros agentes puedan inspeccionar y
 * controlar el juego sin depender del canvas.
 *
 * Se expone únicamente desde el composition root del gameplay playground.
 * La ruta principal de producción no depende de esta API.
 */

import type { GridConfig, CellCoord } from "../../grid/GridConfig";
import type { GridIntegration } from "../../grid/GridIntegration";
import type { GameManager } from "../core/GameManager";
import { PatrolCommand, type CommandStatus, type UnitCommandType } from "../core/UnitCommands";
import type { LevelContext } from "../core/niveles/cargador/LevelContext";
import { EnemyType } from "../core/unidades/Enemy";
import type { Enemy } from "../core/unidades/Enemy";
import type { Tower } from "../core/unidades/Tower";

// ──────────────────────────────────────────────
// Tipos públicos de la API de testing
// ──────────────────────────────────────────────

export interface GameTestState {
  version: string;
  coins: number;
  enemiesCount: number;
  towersCount: number;
  currentWave: number;
  /** Errores internos capturados durante el lifecycle */
  errors: string[];
}

export interface GridTestState {
  columns: number;
  rows: number;
  tileSize: number;
  cells: CellTestState[][];
}

export interface CellTestState {
  col: number;
  row: number;
  type: string;
  occupied: boolean;
  occupantId?: string;
  walkCost: number;
}

export interface TowerTestState {
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  range: number;
  damage: number;
  active: boolean;
  health?: number;
}

export interface EnemyTestState {
  id: string;
  worldX: number;
  worldY: number;
  cell?: CellCoord;
  health?: number;
  active: boolean;
  type?: string;
  command: {
    type: UnitCommandType;
    status: CommandStatus;
  } | null;
}

export interface UnitTestState {
  id: string;
  col: number;
  row: number;
  team: string;
  health: number;
  maxHp: number;
  active: boolean;
  state: string;
  type: "enemy" | "tower";
}

export interface SpawnEnemyResult {
  success: boolean;
  enemyId?: string;
  error?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

export type TestScenarioPreset =
  | "tower-placement"
  | "long-movement-corridor"
  | "hold-position-lane"
  | "hold-fire-stationary"
  | "hold-fire-patrol"
  | "three-cell-patrol-corridor"
  | "single-wave-path-to-base"
  | "five-unit-contended-patrol"
  | "single-unit-death"
  | "friendly-fire-selection"
  | "simultaneous-combat-3v3"
  | "spawn-collision-grid"
  | "two-unit-convoy"
  | "five-unit-march";

export type TestUnitTeam = "player" | "enemy" | "neutral";
export type TestUnitLifecycle = "alive" | "dying" | "dead" | "despawned";
export type TestOrderStatus = "running" | "completed" | "failed" | "cancelled" | "rejected";
export type TestOrderType = "move" | "stop" | "hold-position" | "patrol" | "attack";

export interface BootTestSnapshot {
  lifecycle: "ready";
  version: string;
  renderer: {
    surfaceCount: number;
    width: number;
    height: number;
  };
  errors: ApiError[];
}

export interface ScenarioTestState {
  id: string;
  preset: TestScenarioPreset;
  simulation: "manual";
  frame: number;
  grid: {
    columns: number;
    rows: number;
    tileSize: number;
  };
  landmarks: Record<string, CellCoord>;
  groups: Record<string, CellCoord[]>;
  path: CellCoord[];
  expectedUnitCount?: number;
}

export interface TestOrderSnapshot {
  id: string;
  unitId: string;
  type: TestOrderType;
  status: TestOrderStatus;
  issuedAtFrame: number;
  finishedAtFrame: number | null;
  destination?: CellCoord;
  endpoints?: readonly [CellCoord, CellCoord];
  targetId?: string;
  phase?: "approaching-start" | "outbound" | "returning";
  completedCycles?: number;
  failureCode?: string;
}

export interface TestUnitSnapshot {
  id: string;
  archetype: string;
  team: TestUnitTeam;
  lifecycle: TestUnitLifecycle;
  active: boolean;
  cell: CellCoord | null;
  world: { x: number; y: number };
  occupiedCells: CellCoord[];
  hp: number;
  maxHp: number;
  movement: {
    mode: "idle" | "moving" | "stopped" | "holding" | "patrolling";
    route: CellCoord[];
    targetCell: CellCoord | null;
    stepProgress: number;
  };
  combat: {
    mode: "auto" | "forced" | "disabled";
    targetId: string | null;
    damage: number;
    rangeCells: number;
  };
  order: TestOrderSnapshot | null;
}

export interface ObservedCellTestState {
  cell: CellCoord;
  type: string;
  occupied: boolean;
  occupantId: string | null;
}

export interface TestEventSnapshot {
  sequence: number;
  frame: number;
  scenarioId: string;
  type: string;
  unitId?: string;
  sourceId?: string;
  targetId?: string;
  orderId?: string;
  waveId?: string;
  from?: CellCoord;
  to?: CellCoord;
  cell?: CellCoord;
  amount?: number;
  hpBefore?: number;
  hpAfter?: number;
  reason?: string;
}

export interface TestWaveSnapshot {
  id: string;
  number: number;
  status: "idle" | "running" | "completed";
  unitIds: string[];
  spawnedCount: number;
  reachedBaseCount: number;
}

export interface ScenarioTestSnapshot {
  scenarioId: string;
  frame: number;
  eventSequence: number;
  economy: { coins: number };
  units: TestUnitSnapshot[];
  orders: TestOrderSnapshot[];
  cells: ObservedCellTestState[];
  events: TestEventSnapshot[];
  wave: TestWaveSnapshot | null;
  rules: { friendlyFire: boolean };
  errors: ApiError[];
}

export type AdvanceTestCondition =
  | { type: "event"; eventType: string; unitId?: string; targetId?: string }
  | { type: "unit-entered-cell"; unitId: string; cell?: CellCoord }
  | { type: "all-units-progressed"; unitIds: string[]; minimumTransitions: number }
  | { type: "wave-status"; waveId: string; status: "running" | "completed" }
  | { type: "unit-lifecycle"; unitId: string; lifecycle: TestUnitLifecycle };

export interface AdvanceTestResult {
  elapsedFrames: number;
  matchedEvent: TestEventSnapshot;
  snapshot: ScenarioTestSnapshot;
}

export interface CleanupScenarioResult {
  removedUnitIds: string[];
  remainingTestUnitIds: string[];
  leakedOccupations: ObservedCellTestState[];
  pendingOrderIds: string[];
  pendingProjectileIds: string[];
}

export interface BeginScenarioOptions {
  preset: TestScenarioPreset;
  simulation: "manual";
  seed?: number;
  friendlyFire?: boolean;
}

export interface SpawnTestUnitOptions {
  scenarioId: string;
  id: string;
  archetype: string;
  team: TestUnitTeam;
  cell: CellCoord;
  stats?: {
    hp?: number;
    damage?: number;
    defense?: number;
    rangeCells?: number;
    movementFramesPerCell?: number;
    fireCooldownFrames?: number;
  };
}

export type TestOrderInput =
  | { type: "move"; destination: CellCoord }
  | { type: "stop" }
  | { type: "hold-position" }
  | { type: "patrol"; endpoints: readonly [CellCoord, CellCoord] }
  | { type: "attack"; targetId: string };

export interface IssueTestOrderOptions {
  unitId: string;
  order: TestOrderInput;
}

export interface AdvanceTestSimulationOptions {
  scenarioId: string;
  afterSequence?: number;
  maxFrames: number;
  condition: AdvanceTestCondition;
}

export interface GameTestRuntimePort {
  getBootSnapshot(): BootTestSnapshot;
  beginScenario(options: BeginScenarioOptions): ApiResult<ScenarioTestState>;
  spawnTestUnit(options: SpawnTestUnitOptions): ApiResult<TestUnitSnapshot>;
  issueTestOrder(options: IssueTestOrderOptions): ApiResult<TestOrderSnapshot>;
  getScenarioSnapshot(scenarioId: string): ScenarioTestSnapshot;
  advanceTestSimulation(options: AdvanceTestSimulationOptions): ApiResult<AdvanceTestResult>;
  advanceTestFrames(scenarioId: string, frames: number): ApiResult<ScenarioTestSnapshot>;
  cleanupScenario(scenarioId: string): ApiResult<CleanupScenarioResult>;
}

export interface GameTestApi {
  /**
   * Indica si el juego terminó de cargar assets, pantalla,
   * grilla y estado inicial.
   */
  isReady(): boolean;

  /**
   * Devuelve un objeto JSON serializable con el estado general del juego.
   */
  getState(): GameTestState;

  /**
   * Devuelve información serializable de la grilla.
   */
  getGrid(): GridTestState;

  /**
   * Devuelve las torres activas con su estado.
   */
  getTowers(): TowerTestState[];

  /**
   * Devuelve los enemigos activos con su estado.
   */
  getEnemies(): EnemyTestState[];

  /**
   * Intenta construir una torre en la celda indicada.
   * @returns true si la torre se colocó, false si fue rechazada.
   */
  placeTower(col: number, row: number): boolean;

  /**
   * Inicia o fuerza una oleada de prueba.
   * Si el sistema de oleadas no tiene una próxima acción,
   * fuerza el primer evento del timeline.
   */
  startWave(): void;

  /**
   * Avanza la simulación de forma controlada.
   * Limitación: el juego actual usa Ticker de PixiJS y no tiene
   * un modo de simulación headless. tick() forza N ms de juego real.
   */
  tick(ms: number): void;

  /**
   * Crea un enemigo en una celda específica del grid.
   * @param cellX Columna (0-indexed)
   * @param cellY Fila (0-indexed)
   * @param enemyType Tipo de enemigo: "basic", "fast", "tank", "boss"
   * @returns Resultado con success, enemyId y error en caso de fallo
   */
  spawnEnemy(cellX: number, cellY: number, enemyType: string): SpawnEnemyResult;

  /**
   * Ordena a un enemigo patrullar entre dos celdas.
   * Busca al enemigo por su posición de spawn (fromCol, fromRow).
   * @param fromCol Columna donde se spawneó el enemigo
   * @param fromRow Fila donde se spawneó el enemigo
   * @param toCol Columna de destino del patrol
   * @param toRow Fila de destino del patrol
   * @returns true si el comando se emitió correctamente
   */
  patrolEnemy(fromCol: number, fromRow: number, toCol: number, toRow: number): boolean;

  /**
   * Obtiene todas las unidades activas con su estado y posición en el grid.
   */
  getUnits(): UnitTestState[];

  /**
   * Aplica daño a una unidad activa identificada por su ID.
   * @returns true si la unidad fue encontrada y dañada
   */
  damageUnit(unitId: string, damage: number): boolean;

  /** Devuelve un snapshot atómico del juego una vez completado el arranque. */
  getBootSnapshot(): BootTestSnapshot;

  /** Crea un escenario aislado y pausa el reloj real del juego. */
  beginScenario(options: BeginScenarioOptions): ApiResult<ScenarioTestState>;

  spawnTestUnit(options: SpawnTestUnitOptions): ApiResult<TestUnitSnapshot>;

  issueTestOrder(options: IssueTestOrderOptions): ApiResult<TestOrderSnapshot>;

  /** Obtiene unidades, órdenes, celdas, eventos y errores en el mismo frame. */
  getScenarioSnapshot(scenarioId: string): ScenarioTestSnapshot;

  /** Avanza el reloj manual hasta una condición observable. */
  advanceTestSimulation(options: {
    scenarioId: string;
    afterSequence?: number;
    maxFrames: number;
    condition: AdvanceTestCondition;
  }): ApiResult<AdvanceTestResult>;

  /** Avanza una cantidad exacta de frames sin depender del tiempo real. */
  advanceTestFrames(scenarioId: string, frames: number): ApiResult<ScenarioTestSnapshot>;

  /** Coloca una torre de forma transaccional en un escenario de test. */
  placeTestTower(options: {
    scenarioId: string;
    id: string;
    archetype: string;
    cell: CellCoord;
  }): ApiResult<{ tower: TestUnitSnapshot; cost: number }>;

  /** Inicia una oleada real y devuelve sus IDs y ruta esperada. */
  startTestWave(options: {
    scenarioId: string;
    wave: number;
  }): ApiResult<{ wave: TestWaveSnapshot; path: CellCoord[] }>;

  /** Aplica daño trazable y devuelve el snapshot del evento resultante. */
  applyTestDamage(options: {
    scenarioId: string;
    sourceId?: string;
    targetId: string;
    amount: number;
  }): ApiResult<{ event: TestEventSnapshot; snapshot: ScenarioTestSnapshot }>;

  /** Resuelve ataques declarados contra el mismo snapshot inicial del frame. */
  resolveTestCombatFrame(options: {
    scenarioId: string;
    attacks: Array<{ attackerId: string; targetId: string }>;
  }): ApiResult<{ events: TestEventSnapshot[]; snapshot: ScenarioTestSnapshot }>;

  /** Elimina las entidades del escenario y comprueba que no queden ocupaciones. */
  cleanupScenario(scenarioId: string): ApiResult<CleanupScenarioResult>;
}

// ──────────────────────────────────────────────
// Decoradores de tipo para exponer datos internos
// ──────────────────────────────────────────────

export interface GameManagerDebug {
  readonly gameContext: LevelContext;
}

export interface LevelContextDebug {
  readonly gridIntegration: GridIntegration | null;
  readonly coins: number;
  readonly enemyCreator: { getUnits: (active: boolean) => EnemyLect[] };
  readonly towerCreator: { getUnits: (active: boolean) => TowerLect[] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnemyLect = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TowerLect = any;

// ──────────────────────────────────────────────
// Mapa de tipos de enemigo de test a EnemyType
// ──────────────────────────────────────────────

/**
 * basic -> Goblin, fast -> Ghost, tank/boss -> Skeleton
 */
function testEnemyTypeToInternal(enemyType: string): EnemyType | null {
  switch (enemyType) {
    case "basic":
      return EnemyType.Goblin;
    case "fast":
      return EnemyType.Ghost;
    case "tank":
    case "boss":
      return EnemyType.Skeleton;
    default:
      return null;
  }
}

function notImplemented(method: keyof GameTestApi): never {
  throw new Error(`GameTestApi.${method} is not implemented`);
}

// ──────────────────────────────────────────────
// Implementación
// ──────────────────────────────────────────────

export function createGameTestApi(
  getManager: () => GameManager | null,
  isGameReady: () => boolean,
  runtime?: GameTestRuntimePort,
): GameTestApi {
  let ready = false;

  // Marcar ready después de un frame para dar tiempo a la inicialización
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ready = true;
    });
  });

  const api: GameTestApi = {
    isReady(): boolean {
      return ready && isGameReady();
    },

    getState(): GameTestState {
      const mgr = getManager();
      if (!mgr) {
        return {
          version: APP_VERSION,
          coins: 0,
          enemiesCount: 0,
          towersCount: 0,
          currentWave: 0,
          errors: ["GameManager not initialized"],
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      if (!ctx) {
        return {
          version: APP_VERSION,
          coins: 0,
          enemiesCount: 0,
          towersCount: 0,
          currentWave: 0,
          errors: ["LevelContext not initialized"],
        };
      }

      const activeEnemies = ctx.enemyCreator?.getUnits(true) ?? [];
      const activeTowers = ctx.towerCreator?.getUnits(true) ?? [];

      return {
        version: APP_VERSION,
        coins: ctx.coins ?? 0,
        enemiesCount: activeEnemies.length,
        towersCount: activeTowers.length,
        currentWave: 0, // TODO: el sistema de oleadas no expone índice actual
        errors: [],
      };
    },

    getGrid(): GridTestState {
      const mgr = getManager();
      if (!mgr) {
        return { columns: 0, rows: 0, tileSize: 0, cells: [] };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      const gi = ctx?.gridIntegration;

      if (!gi) {
        return { columns: 0, rows: 0, tileSize: 0, cells: [] };
      }

      const cfg: GridConfig = gi.gridConfig;
      const cells: CellTestState[][] = [];

      for (let row = 0; row < cfg.gridHeight; row++) {
        const rowData: CellTestState[] = [];
        for (let col = 0; col < cfg.gridWidth; col++) {
          const cell = gi.gridState.getCell({ col, row });
          rowData.push({
            col,
            row,
            type: cell?.type ?? "unknown",
            occupied: cell?.occupied ?? false,
            occupantId: cell?.occupantId,
            walkCost: cell?.walkCost ?? 1,
          });
        }
        cells.push(rowData);
      }

      return {
        columns: cfg.gridWidth,
        rows: cfg.gridHeight,
        tileSize: cfg.cellSize,
        cells,
      };
    },

    getTowers(): TowerTestState[] {
      const mgr = getManager();
      if (!mgr) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      const activeTowers = ctx?.towerCreator?.getUnits(true) ?? [];

      return activeTowers.map((t: TowerLect) => {
        const tower = t as Tower;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shootOpts = (t as any).shootOptions;

        return {
          col: tower.col,
          row: tower.row,
          worldX: tower.x,
          worldY: tower.y,
          range: shootOpts?.range ?? 0,
          damage: shootOpts?.damage ?? 0,
          active: tower.active,
          // Tower hereda de Unit que tiene health interno
        };
      });
    },

    getEnemies(): EnemyTestState[] {
      const mgr = getManager();
      if (!mgr) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      const gridConfig = ctx?.gridIntegration?.gridConfig;
      const activeEnemies = ctx?.enemyCreator?.getUnits(true) ?? [];

      return activeEnemies.map((e: EnemyLect) => {
        const enemy = e as Enemy;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyEnemy = e as any;

        return {
          id: enemy.getId(),
          worldX: enemy.x,
          worldY: enemy.y,
          cell: gridConfig ? enemy.getGridCell(gridConfig) : undefined,
          health: anyEnemy.currentHealth,
          active: enemy.active,
          type: enemy.enemyType,
          command: enemy.currentCommand
            ? {
                type: enemy.currentCommand.type,
                status: enemy.currentCommand.status,
              }
            : null,
        };
      });
    },

    getUnits(): UnitTestState[] {
      const mgr = getManager();
      if (!mgr) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      if (!ctx) return [];

      const gi = ctx.gridIntegration;
      const cfg = gi?.gridConfig;

      const result: UnitTestState[] = [];

      const activeEnemies = ctx.enemyCreator?.getUnits(true) ?? [];
      for (const e of activeEnemies) {
        const enemy = e as Enemy;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyEnemy = e as any;
        const cell = cfg ? enemy.getGridCell(cfg) : undefined;
        result.push({
          id: enemy.getId("test"),
          col: cell?.col ?? -1,
          row: cell?.row ?? -1,
          team: "enemy",
          health: anyEnemy.currentHealth ?? 0,
          maxHp: enemy.maxHp,
          active: enemy.active,
          state: enemy.state,
          type: "enemy",
        });
      }

      const activeTowers = ctx.towerCreator?.getUnits(true) ?? [];
      for (const t of activeTowers) {
        const tower = t as Tower;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyTower = t as any;
        const cell = cfg ? tower.getGridCell(cfg) : undefined;
        result.push({
          id: tower.getId("test"),
          col: cell?.col ?? -1,
          row: cell?.row ?? -1,
          team: "player",
          health: anyTower.currentHealth ?? 0,
          maxHp: tower.maxHp,
          active: tower.active,
          state: tower.state,
          type: "tower",
        });
      }

      return result;
    },

    damageUnit(unitId: string, damage: number): boolean {
      const mgr = getManager();
      if (!mgr) return false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      if (!ctx) return false;

      // Search in enemies first
      const allEnemies = ctx.enemyCreator?.getUnits(false) ?? [];
      const enemy = allEnemies.find((e: Enemy) => e.getId("test") === unitId);
      if (enemy) {
        enemy.takeDamage(damage);
        return true;
      }

      // Search in towers
      const allTowers = ctx.towerCreator?.getUnits(false) ?? [];
      const tower = allTowers.find((t: Tower) => t.getId("test") === unitId);
      if (tower) {
        tower.takeDamage(damage);
        return true;
      }

      return false;
    },

    placeTower(col: number, row: number): boolean {
      const mgr = getManager();
      if (!mgr) return false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      const gi = ctx?.gridIntegration;
      if (!gi) return false;

      // Verificar que la celda sea walkable y no esté ocupada
      const cell = gi.gridState.getCell({ col, row });
      if (!cell) return false;
      if (cell.occupied || cell.type === "blocked") return false;

      // Ocupar la celda
      const occupantId = `test-tower-${col}-${row}`;
      gi.gridState.occupyCell({ col, row }, occupantId);

      // Intentar spawnear una torre del pool
      const tower = ctx.towerCreator?.get(false);
      if (!tower) return false;

      tower.setGridPosition(col, row, gi.gridConfig);
      tower.spawn();
      ctx.coins = Math.max(0, (ctx.coins ?? 0) - 100); // costo estimado

      return true;
    },

    startWave(): void {
      const mgr = getManager();
      if (!mgr) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      if (!ctx) return;

      // Forzar spawn de un enemigo de prueba
      const enemy = ctx.enemyCreator?.get(false);
      if (!enemy) return;

      // Posicionar en el spawn point de la grilla
      const gi = ctx.gridIntegration;
      if (gi) {
        const worldSpawn = {
          x: gi.spawn.col * gi.gridConfig.cellSize + gi.gridConfig.cellSize / 2,
          y: gi.spawn.row * gi.gridConfig.cellSize + gi.gridConfig.cellSize / 2,
        };
        enemy.position.set(worldSpawn.x, worldSpawn.y);
      }

      enemy.initializeEnemy(EnemyType.Goblin);
      enemy.spawn();
    },

    tick(ms: number): void {
      // Limitación documentada: el juego no tiene un loop headless.
      // Esta función forza una pausa real usando requestAnimationFrame
      // para que el Ticker de PixiJS avance.
      if (ms <= 0) return;

      const start = performance.now();
      const target = start + ms;

      // Sincrónico: bloqueamos hasta que pase el tiempo
      while (performance.now() < target) {
        // busy-wait — poco elegante pero funciona para tests
      }
    },

    spawnEnemy(cellX: number, cellY: number, enemyType: string): SpawnEnemyResult {
      const mgr = getManager();
      if (!mgr) {
        return { success: false, error: "GameManager not initialized" };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      const gi = ctx?.gridIntegration;
      if (!gi) {
        return { success: false, error: "Grid not initialized" };
      }

      // Validar que cellX/cellY estén dentro de los límites del grid
      if (
        cellX < 0 ||
        cellY < 0 ||
        cellX >= gi.gridConfig.gridWidth ||
        cellY >= gi.gridConfig.gridHeight
      ) {
        return {
          success: false,
          error: `Cell (${cellX}, ${cellY}) is out of grid bounds (${gi.gridConfig.gridWidth}x${gi.gridConfig.gridHeight})`,
        };
      }

      // Validar enemyType
      const internalType = testEnemyTypeToInternal(enemyType);
      if (!internalType) {
        return {
          success: false,
          error: `Unknown enemy type: "${enemyType}". Valid types: basic, fast, tank, boss`,
        };
      }

      const spawnCell = { col: cellX, row: cellY };
      if (!gi.gridState.isWalkable(spawnCell)) {
        return { success: false, error: `Cell (${cellX}, ${cellY}) is blocked or occupied` };
      }

      // Obtener un enemigo del pool
      const enemy = ctx.enemyCreator?.get(false);
      if (!enemy) {
        return { success: false, error: "No available enemy in pool" };
      }

      enemy.initializeEnemy(internalType);
      enemy.initializeTileMovement({
        cells: [],
        gridConfig: gi.gridConfig,
        gridState: gi.gridState,
        start: spawnCell,
        entityType: internalType,
      });
      enemy.spawn();

      const enemyId = enemy.getId();
      if (!enemy.getGridCell(gi.gridConfig)) {
        return { success: false, error: `Could not occupy cell (${cellX}, ${cellY})` };
      }

      return { success: true, enemyId };
    },

    patrolEnemy(fromCol: number, fromRow: number, toCol: number, toRow: number): boolean {
      const mgr = getManager();
      if (!mgr) return false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      const gi = ctx?.gridIntegration;
      if (!gi) return false;

      // Find the enemy by its spawn cell position
      const activeEnemies = ctx.enemyCreator?.getUnits(true) ?? [];
      const enemy = activeEnemies.find((e: Enemy) => {
        const cellCoord = e.getGridCell(gi.gridConfig);
        return cellCoord && cellCoord.col === fromCol && cellCoord.row === fromRow;
      });
      if (!enemy) return false;

      const from: CellCoord = { col: fromCol, row: fromRow };
      const to: CellCoord = { col: toCol, row: toRow };

      // Set up tile movement for the enemy
      enemy.initializeTileMovement({
        cells: [from, to],
        gridConfig: gi.gridConfig,
        gridState: gi.gridState,
        start: { col: fromCol, row: fromRow },
        entityType: "goblin",
      });

      // Issue the patrol command
      const patrolCmd = new PatrolCommand([from, to]);
      enemy.issueCommand(patrolCmd);

      return true;
    },

    getBootSnapshot(): BootTestSnapshot {
      return runtime?.getBootSnapshot() ?? notImplemented("getBootSnapshot");
    },

    beginScenario(options): ApiResult<ScenarioTestState> {
      return runtime?.beginScenario(options) ?? notImplemented("beginScenario");
    },

    spawnTestUnit(options): ApiResult<TestUnitSnapshot> {
      return runtime?.spawnTestUnit(options) ?? notImplemented("spawnTestUnit");
    },

    issueTestOrder(options): ApiResult<TestOrderSnapshot> {
      return runtime?.issueTestOrder(options) ?? notImplemented("issueTestOrder");
    },

    getScenarioSnapshot(scenarioId): ScenarioTestSnapshot {
      return runtime?.getScenarioSnapshot(scenarioId) ?? notImplemented("getScenarioSnapshot");
    },

    advanceTestSimulation(options): ApiResult<AdvanceTestResult> {
      return runtime?.advanceTestSimulation(options) ?? notImplemented("advanceTestSimulation");
    },

    advanceTestFrames(scenarioId, frames): ApiResult<ScenarioTestSnapshot> {
      return runtime?.advanceTestFrames(scenarioId, frames) ?? notImplemented("advanceTestFrames");
    },

    placeTestTower(_options): ApiResult<{ tower: TestUnitSnapshot; cost: number }> {
      return notImplemented("placeTestTower");
    },

    startTestWave(_options): ApiResult<{ wave: TestWaveSnapshot; path: CellCoord[] }> {
      return notImplemented("startTestWave");
    },

    applyTestDamage(_options): ApiResult<{
      event: TestEventSnapshot;
      snapshot: ScenarioTestSnapshot;
    }> {
      return notImplemented("applyTestDamage");
    },

    resolveTestCombatFrame(_options): ApiResult<{
      events: TestEventSnapshot[];
      snapshot: ScenarioTestSnapshot;
    }> {
      return notImplemented("resolveTestCombatFrame");
    },

    cleanupScenario(scenarioId): ApiResult<CleanupScenarioResult> {
      return runtime?.cleanupScenario(scenarioId) ?? notImplemented("cleanupScenario");
    },
  };

  return api;
}

// ──────────────────────────────────────────────
// Declaración global para TypeScript
// ──────────────────────────────────────────────

declare global {
  interface Window {
    __GAME_TEST__?: GameTestApi;
  }
}
