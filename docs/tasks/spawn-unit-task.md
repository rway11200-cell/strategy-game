# Tarea: Crear método `spawnUnit()` en GameTestApi

## Objetivo
Crear un método genérico `spawnUnit()` que permita spawnear cualquier tipo de unidad (enemigos, torres, aliados, etc.) en una celda específica del grid, reutilizando la lógica existente de `spawnEnemy()`.

## Contexto actual
- Ya existe `spawnEnemy(cellX, cellY, enemyType)` → `SpawnEnemyResult` (línea 399 de `GameTestApi.ts`)
- Ya existe `spawnEnemy` como interfaz (línea 132)
- `placeTower(col, row)` coloca torres (desde el pool)
- No hay un método unificado para spawnear cualquier unidad

## Especificación

### Nuevo tipo
```ts
export type UnitType = "enemy" | "tower";

export interface SpawnUnitResult {
  success: boolean;
  unitType: UnitType;
  unitId?: string;
  error?: string;
}
```

### Nuevo método en `GameTestApi`
```ts
spawnUnit(params: {
  type: UnitType;
  subtype?: string;        // "basic"|"fast"|"tank"|"boss" para enemy, undefined para tower
  col: number;
  row: number;
}): SpawnUnitResult;
```

### Comportamiento
1. **type="enemy"** → delega a `spawnEnemy()` existente, usando `subtype` como `enemyType`
2. **type="tower"** → intenta tomar torre del pool (`towerCreator.get()`), posicionarla en `(col, row)` con `setGridPosition()`, ocupar celda y hacer `spawn()`
3. Validar que la celda esté dentro del grid
4. Validar que la celda sea walkable y no esté ocupada
5. Devolver `success: false` con mensaje de error si no es posible

### Criterios de éxito
- `window.__GAME_TEST__.spawnUnit({ type: "enemy", subtype: "basic", col: 0, row: 0 })` spawnea un enemigo básico
- `window.__GAME_TEST__.spawnUnit({ type: "tower", col: 5, row: 3 })` spawnea una torre
- Devuelve error si la celda está ocupada o fuera de límites
- Tests Playwright pueden usar `spawnUnit()` en vez de `spawnEnemy()` + `placeTower()` por separado
- No rompe tests existentes
- No acopla lógica de testing en clases puras del core

### Archivos a modificar
- `src/app/testing/GameTestApi.ts` — agregar tipo `SpawnUnitResult`, interfaz y implementación
- `tests/playwright/` — opcional: crear test que use `spawnUnit()`

### Dependencias
- Ninguna — `spawnEnemy()` y `placeTower()` ya existen como referencia

### Prioridad
Alta — unifica la API de testing
