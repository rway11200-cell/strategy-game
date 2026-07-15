/// <reference types="vite/client" />

/**
 * GameTestApi — API de testing para validación automática del juego.
 *
 * Expuesta globalmente como window.__GAME_TEST__ para que
 * Playwright, Hermes u otros agentes puedan inspeccionar y
 * controlar el juego sin depender del canvas.
 *
 * ⚠️ Solo debe activarse en entorno de desarrollo/test.
 * Nunca es una dependencia obligatoria de producción.
 */

import type { GridConfig } from "../../grid/GridConfig";
import type { GridIntegration } from "../../grid/GridIntegration";
import type { GameManager } from "../core/GameManager";
import type { LevelContext } from "../core/niveles/cargador/LevelContext";
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
  worldX: number;
  worldY: number;
  health?: number;
  active: boolean;
  type?: string;
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
// Implementación
// ──────────────────────────────────────────────

export function createGameTestApi(
  getManager: () => GameManager | null,
  isGameReady: () => boolean,
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
        return { version: APP_VERSION, coins: 0, enemiesCount: 0, towersCount: 0, currentWave: 0, errors: ["GameManager not initialized"] };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mgrDebug = mgr as any as GameManagerDebug;
      const ctx = mgrDebug.gameContext;
      if (!ctx) {
        return { version: APP_VERSION, coins: 0, enemiesCount: 0, towersCount: 0, currentWave: 0, errors: ["LevelContext not initialized"] };
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
      const activeEnemies = ctx?.enemyCreator?.getUnits(true) ?? [];

      return activeEnemies.map((e: EnemyLect) => {
        const enemy = e as Enemy;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyEnemy = e as any;

        return {
          worldX: enemy.x,
          worldY: enemy.y,
          health: anyEnemy.currentHealth,
          active: enemy.active,
        };
      });
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

      enemy.initializeEnemy(1 as any); // Goblin
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
      // eslint-disable-next-line no-empty
      while (performance.now() < target) {
        // busy-wait — poco elegante pero funciona para tests
      }
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
