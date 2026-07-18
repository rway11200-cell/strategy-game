# OpenCode — Reglas de codificación

## Archivos que NO debe modificar sin aprobación humana

Estos archivos son críticos para infraestructura y deploy. OpenCode no debe modificarlos en ninguna tarea a menos que la tarea diga explícitamente "Modificar [archivo]".

### 🚫 Prohibido tocar sin aprobación:

| Archivo | Razón |
|---|---|
| `Dockerfile` | Configuración de deploy. Un error rompe Railway. |
| `docker-compose.yml` | Infraestructura local. |
| `.github/workflows/*.yml` | CI/CD — puede romper tests y deploys. |
| `vite.config.ts` | Configuración de build y servidor. |
| `package.json` — solo `scripts` y `dependencies` | OpenCode puede tocar `devDependencies` si agrega una lib nueva, pero no cambiar `scripts` de start/build/preview. |
| `nginx.conf` (si existe) | Config de servidor web. |
| `scripts/github-actions-*.mjs` | Scripts de monitoreo autónomo. |
| `.autonomy/*` | Estado interno de monitoreo. |

### ⚠️ Requiere aprobación humana:

| Archivo | Razón |
|---|---|
| `src/app/core/GameManager.ts` | Orquestador principal del juego. |
| `src/app/testing/GameTestApi.ts` | API de testing — cambios aquí afectan tests. |
| `src/grid/GridConfig.ts` | Config de la grilla — cambios afectan pathfinding. |
| `tests/playwright/*.ts` | Tests de integración que fallan en CI. |

### ✅ OpenCode puede modificar libremente:

- `src/app/core/unidades/*.ts` — Enemigos, torres, proyectiles
- `src/app/core/niveles/*.ts` — Niveles y oleadas
- `src/app/core/Movement.ts`, `PathFollower.ts`, `TileMovement.ts` — Movimiento
- `src/grid/*.ts` — Pathfinding, ocupación, grilla (excepto GridConfig.ts)
- `src/app/ui/*.ts` — UI del juego
- Cualquier archivo dentro de `src/` no listado arriba
- Tests unitarios en `tests/*.spec.ts`

## Reglas de verificación antes de commit

1. **Siempre ejecutar tests locales antes de commitear:**
   ```bash
   npx vitest run 2>&1 | tail -20
   ```

2. **Verificar que el build no se rompe:**
   ```bash
   npx tsc --noEmit 2>&1 | tail -20
   ```

3. **No cambiar scripts de package.json** (`start`, `build`, `preview`, `dev`).

4. **No cambiar config de Vite** (`vite.config.ts`).

5. **No cambiar Dockerfile ni CI/CD**.

6. Si una tarea requiere cambios en archivos prohibidos, debe:
   - Marcar la tarea como "Needs review"
   - Incluir en `next_actions` una descripción clara del cambio necesario
   - Esperar aprobación humana
