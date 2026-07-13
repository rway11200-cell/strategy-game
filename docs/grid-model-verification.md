# Grid Model Verification

Fecha: 2026-07-13

## Resumen

Se verificó el modelo lógico del grid en ambas ubicaciones (`src/core/grid/GridConfig.ts` y `src/grid/GridConfig.ts`). Se detectaron diferencias y se aplicaron correcciones para que `src/grid/GridConfig.ts` sea autosuficiente como punto de entrada único para el módulo grid.

## 1. Modelo lógico (GridConfig)

### `gridWidth` / `gridHeight` / `cellSize` / `offsetX` / `offsetY`

| Propiedad | Core | src/grid | Estado |
|-----------|------|----------|--------|
| `gridWidth` (columnas) | `number` ✅ | `number` ✅ | Correcto |
| `gridHeight` (filas) | `number` ✅ | `number` ✅ | Correcto |
| `cellSize` (píxeles) | `number` ✅ | `number` ✅ | Correcto |
| `offsetX` (origen mundo) | `number` ✅ | `number` ✅ | Correcto |
| `offsetY` (origen mundo) | `number` ✅ | `number` ✅ | Correcto |
| Defaults | 64, 20, 15, 0, 0 | 64, 20, 15, 0, 0 | ✅ Idénticos |

### `CellCoord {col, row}` vs `Point {x, y}`

- **`Point { x, y }`** (core): semánticamente x=col, y=row. Confuso pero estable.
- **`CellCoord { col, row }`** (src/grid): nombres explícitos, semánticamente equivalente.
- Ambos representan coordenadas de celda (no píxeles).
- `CellCoord` es la versión mejorada; `Point` se mantiene en core por compatibilidad.
- **Conclusión:** modelo correcto, `CellCoord` es la opción canónica para nuevo código.

## 2. Tipos de tile (CellType)

| Tipo | Core (5) | src/grid (6) | Uso |
|------|----------|-------------|-----|
| `"walkable"` | ✅ | ✅ | Terreno transitable |
| `"blocked"` | ✅ | ✅ | Obstáculo (torre, pared) |
| `"spawn"` | ✅ | ✅ | Punto de aparición de enemigos |
| `"base"` | ✅ | ✅ | Base del jugador / destino |
| `"tower"` | ✅ | ✅ | Torre construida |
| `"path"` | ❌ | ✅ | Celda marcada como parte de un path |

**Conclusión:** `"path"` existe solo en src/grid. El core no lo incluye. `GridDebugOverlay` usa un `Record<string, number>` para colores, lo que evita el error de tipo, pero semánticamente `"path"` debería migrarse al core en una unificación futura. Por ahora, src/grid tiene el tipo correcto y completo.

## 3. Conversión celda ↔ mundo

| Función | Core | src/grid (antes) | src/grid (después) |
|---------|------|-------------------|---------------------|
| `gridToWorld(col, row, config) → {x, y}` | ✅ | ❌ No existía | ✅ Re-exportada desde core |
| `worldToGrid(x, y, config) → Point` | ✅ | ❌ No existía | ✅ Re-exportada desde core |
| `Point` type | ✅ | ❌ No existía | ✅ Re-exportado desde core |
| `CELL_TYPES` array | ✅ | ❌ No existía | ✅ Definido localmente con 6 valores |

**Antes del fix:** Los archivos en `src/grid/` importaban `gridToWorld`, `worldToGrid` y `Point` directamente desde `../core/grid/GridConfig`, creando dependencias directas al core.

**Después del fix:** `src/grid/GridConfig.ts` re-exporta `gridToWorld`, `worldToGrid` y `Point` desde el core, más `CELL_TYPES` definido localmente. Todos los archivos en `src/grid/` ahora importan desde `./GridConfig` (local) en vez de `../core/grid/GridConfig`.

## 4. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/grid/GridConfig.ts` | Agregados: `CELL_TYPES` (6 valores), re-exports de `gridToWorld`, `worldToGrid`, `Point` desde core |
| `src/grid/GridDebugOverlay.ts` | Import de `GridConfig`, `gridToWorld`, `Point` cambió de `../core/grid/GridConfig` a `./GridConfig` |
| `src/grid/CellEvents.ts` | Import de `GridConfig`, `worldToGrid` cambió de `../core/grid/GridConfig` a `./GridConfig` |
| `src/grid/GridIntegration.ts` | Import de `gridToWorld`, `GridConfig` cambió de `../core/grid/GridConfig` a `./GridConfig` (unificado con `CellCoord`) |
| `src/grid/Footprint.ts` | Import de `Point` cambió de `../core/grid/GridConfig` a `./GridConfig` |

## 5. Tests

### Tests ejecutados: 2 suites, 19 tests — TODOS PASAN

| Suite | Tests | Resultado |
|-------|-------|-----------|
| `tests/grid/GridConfig.spec.ts` | 5 | ✅ Todos pasan |
| `tests/grid/Coordinates.spec.ts` | 14 | ✅ Todos pasan |

### Suite completa: 36 test files, 215 tests — 1 pre-existing failure

| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` | ✅ Clean |
| `eslint src/grid/ tests/grid/` | ✅ Clean |
| `vitest run` | 1 pre-existing failure (regex lookahead en test-practice/) |
| `npm run build` | ✅ Build exitoso |

## 6. Estado final del módulo grid

```
src/grid/GridConfig.ts        ← Punto de entrada único para tipos grid
  ├── CellType (6 valores)
  ├── CELL_TYPES array
  ├── CellCoord {col, row}
  ├── GridConfig interface
  ├── gridToWorld()           ← re-exportado desde core
  ├── worldToGrid()           ← re-exportado desde core
  ├── Point type              ← re-exportado desde core
  └── createDefaultGridConfig()

src/grid/GridState.ts         ← Estado mutable del grid
src/grid/Pathfinder.ts        ← A* pathfinding
src/grid/GridIntegration.ts   ← Fachada para la capa de juego
src/grid/Footprint.ts         ← Utilidades de path footprint
src/grid/GridDebugOverlay.ts  ← Overlay debug visual [pixi.js]
src/grid/CellEvents.ts        ← Eventos de celda [pixi.js]
```

Ningún archivo en `src/grid/` importa directamente de `src/core/grid/`. Todas las dependencias van a través de `./GridConfig` que re-exporta lo necesario desde el core.
