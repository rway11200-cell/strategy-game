#!/usr/bin/env bash
# github-actions-check.sh — Wrapper para cron sin IA.
# Ejecuta el monitor de GitHub Actions y notifica si hay fallo nuevo.
# Los fallos se registran directamente en Nexo (Notion vía API).
set -euo pipefail

export GH_TOKEN="${GH_TOKEN:-}"
export NEXO_KEY="${NEXO_KEY:-}"
export NEXO_URL="${NEXO_URL:-https://nexo-production-fa29.up.railway.app}"
export GAMEREPO="rway11200-cell/strategy-game"

PROJECT_DIR="/opt/data/proyectos/strategy-game"
cd "$PROJECT_DIR"

OUTPUT=$(node scripts/github-actions-monitor.mjs 2>/dev/null || true)
DECISION=$(echo "$OUTPUT" | head -1)
JSON=$(echo "$OUTPUT" | tail -1)

case "$DECISION" in
  NEW_FAILURE)
    # Extraer info del JSON
    TITLE=$(echo "$JSON" | grep -o '"title":"[^"]*"' | head -1 | sed 's/"title":"//;s/"//')
    SHA=$(echo "$JSON" | grep -o '"sha":"[^"]*"' | head -1 | sed 's/"sha":"//;s/"//')
    RUN_NUM=$(echo "$JSON" | grep -o '"runNumber":[0-9]*' | head -1 | sed 's/.*://')
    URL=$(echo "$JSON" | grep -o '"url":"[^"]*"' | head -1 | sed 's/"url":"//;s/"//')
    NEXO_RUN_ID=$(echo "$JSON" | grep -o '"nexoRunId":"[^"]*"' | head -1 | sed 's/"nexoRunId":"//;s/"//')
    FAILED_STEPS=$(echo "$JSON" | grep -o '"step":"[^"]*"' | sed 's/"step":"//;s/"//' | tr '\n' '; ' || echo "desconocido")

    cat << EOF
❌ GitHub Actions - Fallo nuevo detectado
Run #${RUN_NUM}: ${TITLE}
SHA: ${SHA}
Pasos: ${FAILED_STEPS}
Registrado en Nexo: ${NEXO_RUN_ID}
URL: ${URL}
EOF
    exit 1
    ;;
  DUPLICATE_FAILURE|NO_ACTION)
    # Silencio total — no notificar
    exit 0
    ;;
  *)
    echo "⚠️ GitHub Actions Monitor - ${DECISION}"
    echo "$JSON"
    exit 0
    ;;
esac
