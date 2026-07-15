#!/usr/bin/env bash
# autonomy-check.sh — Wrapper para cron sin IA.
# Ejecuta monitor + gate, y solo notifica si hay acción accionable.
# Diseñado para cron no-agent: stdout silencioso si NO_ACTION.
set -euo pipefail

PROJECT_DIR="/opt/data/proyectos/strategy-game"
cd "$PROJECT_DIR"

# Ejecutar monitor | gate, capturar ambas líneas
OUTPUT=$(node scripts/monitor-railway.mjs 2>/dev/null | node scripts/autonomy-gate.mjs 2>/dev/null || true)

# Primera línea = decisión (NO_ACTION, NEW_FAILURE, etc.)
DECISION=$(echo "$OUTPUT" | head -1)

# El resto es JSON
JSON=$(echo "$OUTPUT" | tail -1)

case "$DECISION" in
  NEW_FAILURE)
    # Extraer fingerprints del JSON (sin node -e para evitar errores de parse)
    FPS=$(echo "$JSON" | grep -o '"fingerprints":\[[^]]*\]' | grep -o '"[^"]*"' | tail -n +2 || echo "unknown")
    echo "❌ Autonomy - Fallo nuevo detectado"
    echo "Fingerprints: $FPS"
    echo ""
    echo "Placeholder: triage IA invocado (no implementado)"
    exit 1
    ;;
  DUPLICATE_FAILURE)
    # Fallo conocido — silencio (no notificar cada 30 min)
    exit 0
    ;;
  READY_TASK)
    echo "📋 Autonomy - Tarea kanban ready"
    echo "$JSON"
    exit 1
    ;;
  NO_ACTION|NO_INPUT)
    # Sin novedades — silencio total
    exit 0
    ;;
  *)
    echo "⚠️ Autonomy - Decisión desconocida: $DECISION"
    echo "$JSON"
    exit 0
    ;;
esac
