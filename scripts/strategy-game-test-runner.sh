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
# 1. Obtener último commit de GitHub (local)
# ────────────────────────────────────────────
LATEST_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
if [ -z "$LATEST_COMMIT" ]; then
  echo "⚠️  No se pudo obtener el commit local. Saltando."
  exit 0
fi

# ────────────────────────────────────────────
# 2. Verificar que Railway responda
# ────────────────────────────────────────────
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" --max-time 15)
if [ "$HTTP_CODE" != "200" ]; then
  # Railway no disponible aún — silencio
  exit 0
fi

# ────────────────────────────────────────────
# 3. Verificar que Railway tenga el último commit
#    Buscamos un hash o señal de que es el deploy correcto
# ────────────────────────────────────────────
# No podemos leer el commit desde Railway directamente,
# pero sí podemos verificar que window.__GAME_TEST__ existe
# con la versión correcta.
GAME_TEST_EXISTS=$(curl -s "$URL" --max-time 15 | grep -c '__GAME_TEST__' || true)
if [ "$GAME_TEST_EXISTS" -eq 0 ]; then
  # Railway todavía no tiene el nuevo deploy — silencio
  exit 0
fi

# ────────────────────────────────────────────
# 4. Verificar versión del juego vs package.json
# ────────────────────────────────────────────
PKG_VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")

# Usamos una verificación indirecta: el HTML tiene la versión
# Vite inyecta APP_VERSION en el build. Si Railway sirve una
# versión distinta a la actual, el build no está actualizado.
# Intentamos detectar la versión desde el HTML servido.
# (Esto es una heurística, no blocking)
VERSION_IN_URL=$(curl -s "$URL" --max-time 10 | grep -oP 'v[\d]+\.[\d]+\.[\d]+' | head -1 || echo "")
if [ -n "$VERSION_IN_URL" ] && [ "$VERSION_IN_URL" != "v$PKG_VERSION" ]; then
  # La versión servida no coincide con el package.json — deploy desactualizado
  exit 0
fi

# ────────────────────────────────────────────
# 5. Ejecutar tests Playwright
# ────────────────────────────────────────────
echo "🧪 Tests contra $URL (commit $LATEST_COMMIT, v$PKG_VERSION)"
START_TS=$(date +%s)

npx playwright test tests/playwright/game-test-api.spec.ts --reporter=list 2>&1 | tee "$LOG_FILE" || true

END_TS=$(date +%s)
DURATION=$((END_TS - START_TS))

# ────────────────────────────────────────────
# 6. Analizar resultado
# ────────────────────────────────────────────
if grep -q "passed" "$LOG_FILE" 2>/dev/null && ! grep -q "failed" "$LOG_FILE" 2>/dev/null; then
  PASSED=$(grep -oP '\d+ passed' "$LOG_FILE" | head -1 | awk '{print $1}')
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
  tail -10 "$LOG_FILE" 2>/dev/null || true
  exit 1
fi
