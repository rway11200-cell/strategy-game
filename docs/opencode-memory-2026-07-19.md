# OpenCode Memory — 2026-07-19

## Último commit
```
dc947b3 [auto] desplegar playgrounds de testing
```
Push realizado. Rama limpia.

## Estado actual del proyecto

### Playgrounds desplegables (tres entradas Vite)
- `/` — Juego Tower Defence normal con marcadores `data-testid="game-root"` y `data-testid="game-canvas"`
- `/__test__/gameplay/` — Entry aislado con motor Pixi, assets, ticker detenido, sin MainScreen ni timeline productiva. Expone `window.__GAME_TEST__`.
- `/__test__/grid-renderer/` — Entry aislado para tests visuales. Expone `window.__GRID_VISUAL_TEST__`.

### Arquitectura de testing

**GameTestApi** (`src/app/testing/GameTestApi.ts`):
- Contrato futuro completo con tipos exportados: `GameTestRuntimePort`, `BeginScenarioOptions`, `BootTestSnapshot`, `ScenarioTestSnapshot`, `TestUnitSnapshot`, `TestOrderSnapshot`, `TestEventSnapshot`, `ObservedCellTestState`, `CleanupScenarioResult`, `AdvanceTestResult`, etc.
- Métodos legacy: `isReady()`, `getState()`, `getGrid()`, `getTowers()`, `getEnemies()`, `placeTower()`, `startWave()`, `tick()`, `spawnEnemy()`, `patrolEnemy()`, `getUnits()`, `damageUnit()`
- Métodos futuros con stub `notImplemented()`: `getBootSnapshot`, `beginScenario`, `spawnTestUnit`, `issueTestOrder`, `getScenarioSnapshot`, `advanceTestSimulation`, `advanceTestFrames`, `placeTestTower`, `startTestWave`, `applyTestDamage`, `resolveTestCombatFrame`, `cleanupScenario`
- `GameTestRuntimePort` declara: `getBootSnapshot`, `beginScenario`, `getScenarioSnapshot`, `cleanupScenario`
- Los stubs delegan a `runtime?.metodo()` si existe runtime, o lanzan `notImplemented()`.

**ScenarioCatalog** (`src/app/testing/ScenarioCatalog.ts`):
- Presets implementados: `three-cell-patrol-corridor`, `tower-placement`
- Pendientes: `long-movement-corridor`, `hold-position-lane`, `hold-fire-stationary`, `hold-fire-patrol`, `single-wave-path-to-base`, `five-unit-contended-patrol`, `single-unit-death`, `friendly-fire-selection`, `simultaneous-combat-3v3`

**GameplayTestRuntime** (`src/app/testing/GameplayTestRuntime.ts`):
- Implementa `GameTestRuntimePort`.
- `getBootSnapshot()`: devuelve renderer y versión reales desde el harness.
- `beginScenario()`: crea escenario lógico con catálogo, frame 0, evento `scenario.started`.
- `getScenarioSnapshot()`: snapshot atómico desde DTO interno.
- `cleanupScenario()`: idempotente, devuelve resultado vacío.
- NO tiene aún: estado real con GridState/Container/Enemy, ni implementación de spawn/órdenes/avance.

**gameplayEntry.ts** (`src/app/testing/gameplayEntry.ts`):
- Inicializa engine Pixi, detiene ticker, crea runtime, expone `__GAME_TEST__`.
- NO espera aún assets del bundle `main` (necesario para sprites de goblin).

**GameTestDriver** (`tests/playwright/support/GameTestDriver.ts`):
- `open()` navega a `/__test__/gameplay/` y verifica el marcador `data-harness="strategy-game-playwright"`.

**GameTestFixture** (`tests/playwright/support/GameTestFixture.ts`):
- `try/finally` con `cleanupStartedScenarios()`.

### Tests Playwright

| Test | Estado |
|---|---|
| `game-test-api.spec.ts` — Boot snapshot | ✅ Verde |
| `game-test-api.spec.ts` — Grid contract | ✅ Verde |
| `game-test-api.spec.ts` — Tower placement | ❌ `placeTestTower not implemented` |
| `patrol-between-points.spec.ts` | ❌ `spawnTestUnit not implemented` |
| `t2-stop-move.spec.ts` | ❌ `beginScenario not implemented` |
| `t4-hold-position-no-move.spec.ts` | ❌ `beginScenario not implemented` |
| `t5-wave-path-to-base.spec.ts` | ❌ `beginScenario not implemented` |
| `t6-hold-position-attacks.spec.ts` | ❌ `beginScenario not implemented` |
| `t7-multi-patrol-no-collision.spec.ts` | ❌ `beginScenario not implemented` |
| `t8-unit-death-releases-cell.spec.ts` | ❌ `beginScenario not implemented` |
| `t10-friendly-fire-off.spec.ts` | ❌ `beginScenario not implemented` |
| `combat-3vs3.spec.ts` | ❌ `beginScenario not implemented` |
| `grid-render-screenshot.spec.ts` | ❌ `renderFixture not implemented` |
| `production-smoke.spec.ts` | ❌ `/health/ready` no implementado |

### Tests unitarios
- `tests/GameplayTestRuntime.spec.ts` (3 tests): ✅ Todos verdes
- `tests/UnitCommands.spec.ts` (6 tests): ✅ Todos verdes

### Infraestructura
- `vite.playwright.config.ts`: sirve `/__test__/gameplay/`, `/__test__/grid-renderer/`, `/__test__/health`
- `playwright.production.config.ts`: solo `production-smoke.spec.ts`
- `scripts/assert-deployment-artifact.mjs`: verifica que las tres entradas existan en dist
- `Dockerfile`: build productivo sin `VITE_ENABLE_GAME_TEST_API`

## Próximo vertical a implementar
Patrulla determinista real con clases del dominio:
1. ID estable en Unit/Enemy
2. Getters de movimiento en PathFollower/TileMovement/Unit
3. `despawnImmediately()` en Unit
4. Refactor de GameplayTestRuntime con GridState, Container, reloj manual real
5. spawnTestUnit (goblin), issueTestOrder (patrol), advanceTestFrames, eventos, cleanup
6. Hacer pasar patrol-between-points.spec.ts completamente

## Archivos que se modificarán
- `src/app/core/unidades/Unit.ts`
- `src/app/core/unidades/Enemy.ts`
- `src/app/core/PathFollower.ts`
- `src/app/core/TileMovement.ts`
- `src/app/testing/GameTestApi.ts`
- `src/app/testing/GameplayTestRuntime.ts`
- `src/app/testing/gameplayEntry.ts`
- `tests/GameplayTestRuntime.spec.ts`
