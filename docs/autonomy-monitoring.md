# Autonomy Monitoring — Strategy Game

## Flujo Actual

```
OpenCode edita código → Hermes commit + push → Railway deploy
                                                      ↓
                                        Cron cada 30 min (SIN IA)
                                              ↓
                                        monitor-railway.mjs
                                              ↓
                                        autonomy-gate.mjs
                                              ↓
                               ┌─────────────┼─────────────┐
                          NO_ACTION    DUPLICATE      NEW_FAILURE
                          (silencio)   (silencio)     (notifica)
```

## Mecánica

### monitor-railway.mjs

Script Node.js sin dependencias externas (solo `fetch` nativo de Node 20+).

**Qué valida:**

1. **Home** — HTTP 200 en `{{RAILWAY_APP_URL}}/`
2. **version.json** — existe, es JSON válido, contiene version/commit/buildTime
3. **Assets** — detecta JS/CSS desde el HTML, verifica HEAD (no 404)
4. **Game skeleton** — el HTML contiene contenedor pixi/canvas/game

**Fingerprints** generados:

| Patrón | Significado |
|---|---|
| `railway:prod:home:http-XXX` | Home respondió con status XXX |
| `railway:prod:version:missing` | /version.json no existe (404) |
| `railway:prod:version:http-XXX` | /version.json respondió XXX |
| `railway:prod:assets:NOMBRE-XXX` | Asset dio error XXX |
| `railway:prod:game:skeleton-missing` | No se detecta canvas del juego |
| `railway:prod:network:timeout` | Timeout de red |
| `railway:prod:network:fetch-error` | Error de conexión |

### autonomy-gate.mjs

Toma el output del monitor y decide:

| Decisión | Significado | Acción |
|---|---|---|
| `NO_ACTION` | Sin fallos nuevos, sin tareas ready | Silencio — no IA |
| `NEW_FAILURE` | Fingerprint nuevo detectado | **Notifica** — invoca triage IA (placeholder) |
| `DUPLICATE_FAILURE` | Fallo ya conocido | Silencio — actualiza contador |
| `READY_TASK` | Tarea kanban lista | **Notifica** — invoca worker IA (placeholder) |

### .autonomy/monitor-state.json

Estado persistente del monitor:

```json
{
  "lastRun": "ISO timestamp",
  "lastStatus": "ok | fail",
  "lastFingerprint": "railway:prod:...",
  "openFingerprints": [
    {
      "fingerprint": "railway:prod:version:missing",
      "firstSeen": "ISO timestamp",
      "lastSeen": "ISO timestamp",
      "count": 3,
      "resolved": false
    }
  ],
  "repeatCount": 0,
  "lastSuccessAt": "ISO timestamp",
  "lastFailureAt": "ISO timestamp",
  "lastVersion": "0.1.0",
  "lastCommit": "abc123"
}
```

### Lock

Archivo `.autonomy/monitor.lock` evita ejecuciones simultáneas. Expira después de 10 minutos.

## Variables de Entorno

| Variable | Obligatorio | Default | Descripción |
|---|---|---|---|
| `RAILWAY_APP_URL` | No | `https://strategy-game-production-0277.up.railway.app` | URL base del deploy |

## Cómo correr manualmente

```bash
# Solo monitor
cd /ruta/al/proyecto
RAILWAY_APP_URL="https://..." node scripts/monitor-railway.mjs

# Monitor + Gate (recomendado)
RAILWAY_APP_URL="https://..." node scripts/monitor-railway.mjs | node scripts/autonomy-gate.mjs

# Via npm scripts
npm run autonomy:monitor
npm run autonomy:gate
npm run autonomy:check    # monitor | gate
```

## Cómo está programado en cron

```bash
# Cron en Hermes (no-agent, cada 30 min)
cronjob action=create \
  name="strategy-game-monitor-sin-IA" \
  schedule="every 30m" \
  no_agent=true \
  script="autonomy-check.sh"
```

El script `autonomy-check.sh` es un wrapper que:
1. Corre `monitor-railway.mjs | autonomy-gate.mjs`
2. Si el gate dice `NO_ACTION` o `DUPLICATE_FAILURE` → exit 0 (silencio)
3. Si el gate dice `NEW_FAILURE` o `READY_TASK` → notifica a Telegram

## Deduplicación de Fallos

1. El monitor genera fingerprints normalizados: `railway:prod:<categoría>:<etiqueta>`
2. El gate compara contra `openFingerprints` en el estado
3. Si el fingerprint **no existe** → `NEW_FAILURE`
4. Si el fingerprint **ya existe** y no está `resolved` → `DUPLICATE_FAILURE` (solo contador)
5. Si el fingerprint estaba `resolved` y reaparece → se trata como nuevo

## Cuándo se invoca IA

**Fase 1 (actual):** Placeholder. El gate imprime "Placeholder: triage IA invocado (no implementado)" pero no hace nada.

**Fase 2 (próxima):** 
- `invokeAiTriage(failure)` → Hermes analiza el fingerprint y crea tarea kanban si amerita
- `invokeAiWorker(task)` → Hermes ejecuta la tarea y hace commit+push

## Limitaciones Actuales

- `/version.json` no existe en Railway hasta que se pushee el plugin de build (commit pendiente)
- El placeholder de triage IA no hace nada real
- No hay integración con Notion para persistir resultados (solo archivo local)
- El monitor no puede validar `window.__GAME_TEST__` porque no ejecuta JS
- El build local no completa (se cuelga en "rendering chunks") — posiblemente por plugins pesados
- No hay tests locales automáticos pre-commit (pendiente para OpenCode)

## Próxima Fase Recomendada

1. Pushear commits actuales (version.json plugin, monitor, gate) para que Railway tenga `/version.json`
2. Implementar `invokeAiTriage()` real: Hermes lee el fingerprint y crea tarea kanban
3. Implementar `invokeAiWorker()` real: Hermes ejecuta tarea kanban
4. Integrar con Notion: el monitor escribe resultados a una DB de Notion
5. Configurar OpenCode para tests locales pre-commit
6. El build local no termina — investigar por qué se cuelga en "rendering chunks"
