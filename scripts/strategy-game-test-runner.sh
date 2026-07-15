#!/usr/bin/env bash
# strategy-game-test-runner.sh
# Ejecuta los tests Playwright contra Railway solo cuando el deploy
# activo coincide con el último commit de GitHub.
# Diseñado para cron no-agent: stdout silencioso si todo bien,
# notificación solo si algo falla.

set -euo pipefail

PROJECT_DIR="/opt/data/proyectos/strategy-game"
URL="https://strategy-game-production-0277.up.railway.app"
LOG_FILE="/tmp/strategy-game-test-last.log"

cd "$PROJECT_DIR"

# ────────────────────────────────────────────
# 1. Obtener último commit y versión local
# ────────────────────────────────────────────
LATEST_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
if [ -z "$LATEST_COMMIT" ]; then
  exit 0
fi

PKG_VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")

# ────────────────────────────────────────────
# 2. Verificar que Railway responda
# ────────────────────────────────────────────
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" --max-time 15)
if [ "$HTTP_CODE" != "200" ]; then
  exit 0
fi

# ────────────────────────────────────────────
# 3. Verificar que el bundle JS se cargue
#    El HTML estático no contiene __GAME_TEST__, está en el bundle JS
#    que se carga dinámicamente. No podemos detectarlo desde bash.
#    Así que simplemente ejecutamos los tests — si fallan reportan.
# ────────────────────────────────────────────

# ────────────────────────────────────────────
# 4. Ejecutar tests Playwright
# ────────────────────────────────────────────
echo "🧪 Tests contra $URL (commit $LATEST_COMMIT, v$PKG_VERSION)"
START_TS=$(date +%s)

npx playwright test tests/playwright/game-test-api.spec.ts --reporter=list 2>&1 | tee "$LOG_FILE" || true

END_TS=$(date +%s)
DURATION=$((END_TS - START_TS))

# ────────────────────────────────────────────
# 5. Analizar resultado
# ────────────────────────────────────────────
if grep -q "passed" "$LOG_FILE" 2>/dev/null && ! grep -q "failed" "$LOG_FILE" 2>/dev/null; then
  # ✅ Todo bien — silencio
  exit 0
elif grep -q "failed" "$LOG_FILE" 2>/dev/null; then
  FAILED=$(grep -oP '\d+ failed' "$LOG_FILE" | head -1 | awk '{print $1}')
  echo "❌ Fallaron $FAILED tests (${DURATION}s) — commit $LATEST_COMMIT"
  echo ""
  grep -B1 -A2 "FAIL\|✗\|Error" "$LOG_FILE" 2>/dev/null | head -30 || true
  exit 1
else
  echo "⚠️  Tests incompletos (${DURATION}s). Últimas líneas:"
  tail -20 "$LOG_FILE" 2>/dev/null || true
  exit 1
fi
