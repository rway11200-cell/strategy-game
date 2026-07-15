/**
 * Test rápido de la GameTestApi via Railway.
 * Usa Puppeteer/Playwright inline para validar window.__GAME_TEST__
 *
 * Uso: node tests/quick-test.mjs
 */

const URL = "https://strategy-game-production-0277.up.railway.app";

// No tenemos Playwright fácil de CLI, usamos el enfoque más simple:
// curl + evaluación inline via browser_console no aplica acá.
// Este script documenta qué probar manualmente.
console.log(`
═══════════════════════════════════════════
  GameTestApi — Tests manuales
═══════════════════════════════════════════

Abre ${URL} y en la consola del navegador:

── Pruebas básicas ──

1. ¿Existe la API?
   window.__GAME_TEST__ !== undefined
   → Debe decir true

2. ¿El juego cargó?
   window.__GAME_TEST__.isReady()
   → Debe decir true

3. Estado general:
   window.__GAME_TEST__.getState()
   → Debe mostrar: { version, coins, enemiesCount, towersCount, currentWave, errors }

4. Versión:
   window.__GAME_TEST__.getState().version
   → Debe decir "0.0.0"

5. Grilla:
   window.__GAME_TEST__.getGrid()
   → Debe mostrar: { columns, rows, tileSize, cells }

6. Colocar torre (si hay celdas libres):
   window.__GAME_TEST__.placeTower(5, 5)
   → Debe decir true o false según la celda

7. Iniciar oleada:
   window.__GAME_TEST__.startWave()
   → getState().enemiesCount debe aumentar

── Criterios de éxito ──

✅ window.__GAME_TEST__ existe
✅ isReady() = true
✅ getState() es JSON serializable
✅ getGrid() tiene columns > 0, rows > 0, tileSize > 0
✅ placeTower() no lanza errores
✅ startWave() no lanza errores
✅ No hay page errors en consola
`);
