# Grid System Audit

## Resumen ejecutivo

El sistema de grilla tiene una arquitectura limpia en general — separación core/render respetada, sin dependencias circulares, y con un DAG estricto de dependencias. Sin embargo, hay una **duplicación problemática de `GridConfig`** entre `src/core/grid/` y `src/grid/` que genera inconsistencia de tipos, confusión en imports, y riesgo de divergencia futura.

**Hallazgos clave:** 7 archivos core lógicos (sin Pixi.js), 3 archivos render (con Pixi.js), 5 archivos app consumidores, 9 tests. 0 ciclos. 1 duplicación crítica.

---

## Archivos inventariados

### Core lógico (sin dependencias de Pixi.js)

| Archivo | Rol | Dependencias internas |
|---------|-----|-----------------------|
| `src/core/grid/GridConfig.ts` | Tipos fundacionales: `CellType`, `Point`, `GridConfig`, `gridToWorld()`, `worldToGrid()` | Ninguna |
| `src/core/grid/index.ts` | Barrel file, re-exporta todo `src/core/grid/` | `./GridConfig`, `./GridRenderer` |
| `src/grid/GridConfig.ts` | **Duplicado parcial** de `src/core/grid/GridConfig.ts`. Define `CellCoord`, `CellType` (6 valores vs 5), `createDefaultGridConfig()` | Ninguna |
| `src/grid/GridState.ts` | Estado mutable del grid: matriz 2D de `CellState`, `getCell/setCell/isWalkable/occupyCell/liberateCell` con `onChange` | `./GridConfig` |
| `src/grid/Pathfinder.ts` | A* pathfinding sobre `GridState`, entrada/salida `CellCoord[]`, heurística Manhattan, 4 direcciones | `./GridConfig`, `./GridState` |
| `src/grid/GridIntegration.ts` | Fachada que combina `GridState` + `Pathfinder` + `gridToWorld()`. Punto de entrada único para la capa de juego | `../core/grid/GridConfig`, `./GridConfig`, `./GridState`, `./Pathfinder` |
| `src/grid/Footprint.ts` | Utilidades para footprints de path: `PathCell`, `Footprint`, `isContiguous()`, conversores | `../core/grid/GridConfig` |

### Render (dependen de Pixi.js)

| Archivo | Rol | Dependencias externas |
|---------|-----|-----------------------|
| `src/core/grid/GridRenderer.ts` | Renderiza grid con colores por tipo de celda, hover/selection overlays | `pixi.js` (Container, Graphics) |
| `src/grid/GridDebugOverlay.ts` | Overlay debug: celdas coloreadas, líneas de grid, path resaltado. Toggle con tecla G | `pixi.js` (Container, Graphics) |
| `src/grid/CellEvents.ts` | Traduce eventos Pixi.js (`pointerdown`, `globalpointermove`) a eventos de celda (`onClick`, `onEnter`, `onLeave`, `onHover`). `router` es testeable sin Pixi | `pixi.js` (Container, FederatedPointerEvent, Graphics) |

### App consumers (usan grid desde la capa de juego)

| Archivo | Rol | Grid imports |
|---------|-----|--------------|
| `src/app/core/GameManager.ts` | Crea `GridIntegration` con datos del nivel. Orquesta el loop de juego | `../../core/grid/GridConfig`, `../../grid/GridConfig`, `../../grid/GridIntegration` |
| `src/app/core/niveles/cargador/LevelContext.ts` | Contexto de nivel, contiene `gridIntegration: GridIntegration \| null` | `../../../../grid/GridIntegration` (type-only) |
| `src/app/core/niveles/cargador/LevelSchema.ts` | Tipos del JSON de nivel, define `PathDef.grid?` | Ninguno (solo define tipos) |
| `src/app/core/niveles/acciones/SpawnEnemiesAction.ts` | Spawnea enemigos usando `context.gridIntegration.calculatePath()` cuando está disponible | Ninguno directo (usa `context.gridIntegration`) |
| `src/app/core/PathFollower.ts` | Sigue waypoints (pixeles mundiales). Consume output de `calculatePath()` | Ninguno (solo consume coordenadas mundo) |

### Tests

| Archivo | Qué prueba | Usa Pixi.js |
|---------|-----------|-------------|
| `tests/grid/GridConfig.spec.ts` | `createDefaultGridConfig`, `CellCoord`, `CellType` | No |
| `tests/grid/GridState.spec.ts` | getCell, setCell, isWalkable, occupyCell, liberateCell, onChange | No |
| `tests/grid/GridDebugOverlay.spec.ts` | Constructor, toggle, render, destroy, onToggle | No (usa `EventTarget` mock) |
| `tests/grid/GridIntegration.spec.ts` | `calculatePath`, cell operations, blocked cells | No |
| `tests/grid/CellEvents.spec.ts` | onClick, onEnter/onLeave, onHover, attach/detach | **Sí** (Container) |
| `tests/grid/Footprint.spec.ts` | pathToFootprint, footprintToPoints, isContiguous, roundtrip | No |
| `tests/grid/PathCells.spec.ts` | Contiguidad, shortest path, blocked cells, walkCost, edge cases | No |
| `tests/grid/Pathfinder.spec.ts` | A* básico: recta, obstáculos, bloqueado, sin salida | No |
| `tests/grid/Coordinates.spec.ts` | `gridToWorld`/`worldToGrid` roundtrip, bordes, default parity | No |

---

## Diagrama de dependencias

```
  src/grid/GridConfig.ts       src/core/grid/GridConfig.ts
  (CellCoord, GridConfig,      (Point, GridConfig, CellType,
   CellType +"path")             gridToWorld, worldToGrid,
         |                       CELL_TYPES)
         |                              |
         v                              v
  src/grid/GridState.ts     src/core/grid/GridRenderer.ts [pixi.js]
         |                              |
         v                              v
  src/grid/Pathfinder.ts     src/core/grid/index.ts (barrel, no usado)
         |                   
         v                   
  src/grid/GridIntegration.ts ---importa de ambos GridConfig---
         |                   
         v                   
  src/grid/Footprint.ts (usa Point de core)
  src/grid/GridDebugOverlay.ts [pixi.js]
  src/grid/CellEvents.ts [pixi.js]
         |
         v
  +------+------+
  |             |
  v             v
  GameManager   LevelContext
  SpawnEnemiesAction (vía context)
```

**Ningún ciclo.** Las flechas van estrictamente en una dirección: `src/app/ → src/grid/ → src/core/grid/`. `src/core/grid/` no conoce a `src/grid/` ni a `src/app/`.

---

## Análisis de acoplamiento

### ✅ Buenas prácticas
1. **Core lógico sin Pixi.js** — `GridState`, `Pathfinder`, `GridIntegration`, `Footprint` no importan Pixi.js. Las 3 dependencias de Pixi.js están en archivos de render explícitamente nombrados.
2. **DAG sin ciclos** — No hay dependencias circulares en ningún nivel.
3. **GridIntegration como fachada** — Un solo punto de entrada que la capa de juego usa, encapsulando GridState + Pathfinder + coordenadas.
4. **Router testeable en CellEvents** — La lógica de eventos (ruteo de coordenadas a celdas) está en `router.handlePointerDown/Move` que son funciones puras sin dependencia de Pixi.

### ❌ Problemas

#### P1. Duplicación crítica de GridConfig (ALTA PRIORIDAD)
`src/core/grid/GridConfig.ts` y `src/grid/GridConfig.ts` definen:
- Misma interfaz `GridConfig` duplicada
- `CellType` en core: 5 valores. `CellType` en src/grid: 6 valores (agrega `"path"`)
- `Point` solo en core; `CellCoord` solo en src/grid
- `gridToWorld`/`worldToGrid` solo en core
- `CELL_TYPES` solo en core
- `CellState` en core vs `CellState` diferente en `GridState.ts`
- `createGridConfig` en core vs `createDefaultGridConfig` en src/grid (funcionalmente idénticas)

**Riesgo:** Si alguien modifica un `GridConfig` sin modificar el otro, los tipos divergen y se producen errores difíciles de depurar. `GridIntegration` importa de ambos, creando un acoplamiento doble.

#### P2. Barrel file `src/core/grid/index.ts` no se usa (MEDIA)
Ningún archivo fuera de `src/core/grid/` importa desde `./index`. Todos los consumidores importan directamente de `./GridConfig` o `./GridRenderer`. O se elimina o se migran los imports.

#### P3. Dual mode grid/raw points (BAJA)
`SpawnEnemiesAction` bifurca entre grid y raw points según si `selectedPath.grid && context.gridIntegration` existe. Esto es necesario durante la migración pero agrega complejidad y puede ocultar bugs.

#### P4. GameManager con doble import de GridConfig (MEDIA)
`GameManager.ts` importa `createGridConfig` desde `../../core/grid/GridConfig` y `type CellCoord` desde `../../grid/GridConfig`. Esto confunde sobre qué fuente es la canónica.

#### P5. Footprint.ts usa Point de core (BAJA)
`Footprint.ts` define `PathCell { col, row }` pero sus conversores `pathToFootprint`/`footprintToPoints` usan `Point { x, y }` de `src/core/grid/GridConfig`. Esto es correcto semánticamente (los puntos de pathfinding ahora son CellCoord, y Footprint sirve como puente), pero el naming `Point` vs `PathCell` es confuso porque ambos representan coordenadas de celda.

---

## Recomendaciones

### 1. Unificar GridConfig (ALTA)
- Mover `CellCoord` a `src/core/grid/GridConfig.ts` y eliminar `src/grid/GridConfig.ts`
- Unificar `createGridConfig` y `createDefaultGridConfig` (mantener solo una, con merge de parciales)
- Unificar `CellType` a 6 valores (agregar `"path"` al core)
- Mover `CELL_TYPES` actualizado al core

### 2. Migrar todos los imports a la fuente canónica
- `src/grid/GridConfig.ts` no existe más → todos los `./GridConfig` en `src/grid/` pasan a `../core/grid/GridConfig`
- Eliminar barrel file si no se usa, o empezar a usarlo

### 3. Simplificar dual mode
- Una vez que todos los niveles tengan `grid` definido, eliminar la rama raw points y forzar grid siempre

### 4. Renombrar Footprint para consistencia
- `pathToFootprint` podría aceptar `CellCoord[]` directamente en vez de `Point[]`
- O renombrar `Point` en el core a algo menos ambiguo

---

## Bugs observados (no corregidos)

1. `GridDebugOverlay.ts` línea 28: la propiedad `onVisibilityChange` tiene typo (debería ser `onVisibilityChange` en lugar de `onVisibilityChange`). Solo es un nombre de campo privado, no afecta API pública.
2. `SpawnEnemiesAction.ts` línea 24: `this.enemiesToSpawn.sort(() => Math.random() - 0.5)` — mezcla las waves. Esto no es un bug de grid pero es un efecto secundario sorpresivo en el constructor (mezclar el orden de spawn).
