# Autonomía — Strategy Game

## Estado actual (Julio 2026)

### Arquitectura general

```
GitHub Actions (Playwright tests)
        │
        ▼ (push a main)
Railway deploy automático
        │
        ▼
GitHub Actions espera deploy + corre tests
        │
        ├─ ✅ Pasan → silencio
        └─ ❌ Fallan → queda registrado en GitHub

Cada 15 min:
  github-actions-monitor (NO-agent, sin IA)
        │
        ├─ Consulta GitHub API → último workflow run
        ├─ ¿Fallo nuevo?
        │    ├─ No → silencio (exit 0)
        │    └─ Sí → POST /coding-loop/runs a Nexo → registra en Notion
        │
        └─ Notificación a Telegram solo si NEW_FAILURE
```

### Crons activos relacionados

| Nombre | Tipo | Schedule | Estado | Qué hace |
|---|---|---|---|---|
| **github-actions-monitor** | No-agent | c/15min | ✅ Activo | Consulta GitHub Actions, registra fallos en Nexo/Notion |
| strategy-game-monitor-sin-IA | No-agent | c/30min | ⏸️ Pausado | Monitor HTTP a Railway (reemplazado por GitHub Actions) |
| autonomous-coding-loop | Con IA | c/30min | ⏸️ Pausado | Loop autónomo antiguo (desactivado) |

### Nexo (API Proxy)

**URL:** https://nexo-production-fa29.up.railway.app
**API Key:** configurada en scripts

**Endpoints usados:**
- `POST /coding-loop/runs` → Registrar resultado de ejecución/fallo
- `GET /coding-loop/runs` → Consultar runs existentes (para evitar duplicados)
- `GET /coding-loop/tasks?status=Ready&approved=true` → Buscar próxima tarea
- `POST /coding-loop/tasks` → Crear tarea

### Flujo de detección de fallos

1. Push a main → GitHub Actions corre tests Playwright
2. Si falla → Actions queda con conclusion=failure
3. `github-actions-monitor` detecta el failure nuevo
4. Genera fingerprint: `gh:strategy-game:run-{N}:failure`
5. Verifica si ya existe en Nexo (duplicado)
6. Si es nuevo → `POST /coding-loop/runs` a Nexo con detalles
7. Notifica a Telegram

### Scripts

| Script | Propósito |
|---|---|
| `scripts/github-actions-monitor.mjs` | Consulta GitHub API, decide si es fallo nuevo, registra en Nexo |
| `scripts/github-actions-check.sh` | Wrapper bash para cron no-agent |
| `scripts/github-actions-state.json` | Estado local (último run visto, fingerprints) |

### Notion DBs (Autonomous Coding Loop)

Las DBs están dentro de la página "Autonomous Coding Loop":
- **Projects:** `39b06589-4ee5-8068-b292-f3a7e1e60bb2`
- **Tasks:** `39b06589-4ee5-80ca-85a4-c7387330180c`
- **Run Log:** `39b06589-4ee5-8032-99ad-d902b29028ba`

### Próximos pasos (pendientes)

1. **Fase 1:** Tests unitarios que fallen — validar movimiento de enemigos (TileMovement)
2. **Corregir TileMovement:** interpolación suave, cola de espera, calibrar velocidades
3. **Fase 3:** Oleadas visibles, UI de wave counter, enemigos caminando suavemente
4. **Fase 4:** Tests Playwright que validen comportamiento visual
5. **Conectar fallos de tests → creación de tareas en Nexo** (cuando haya un fallo nuevo, crear tarea automática en Tasks DB)
