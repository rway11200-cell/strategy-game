import { initDevtools } from "@pixi/devtools";
import { setEngine } from "./app/getEngine";
import { LoadScreen } from "./app/screens/LoadScreen";
import { MainScreen } from "./app/screens/main/MainScreen";
import { userSettings } from "./app/utils/userSettings";
import { CreationEngine } from "./engine/engine";
import { createGameTestApi } from "./app/testing/GameTestApi";
import { createGridVisualTestApi } from "./app/testing/GridVisualTestApi";

/**
 * Importing these modules will automatically register there plugins with the engine.
 */
import "@pixi/sound";
// import "@esotericsoftware/spine-pixi-v8";

// Create a new creation engine instance

const engine = new CreationEngine();

initDevtools({ app: engine });
setEngine(engine);

(async () => {
  // Initialize the creation engine instance
  await engine.init({
    background: "#333333ff",
    resizeOptions: { minWidth: 768, minHeight: 1024, letterbox: false },
  });

  // Initialize the user settings
  userSettings.init();

  // Show the load screen
  await engine.navigation.showScreen(LoadScreen);
  // Show the main screen once the load screen is dismissed
  await engine.navigation.showScreen(MainScreen);
})();

function getMainScreen(): MainScreen | null {
  const current = engine.navigation.currentScreen;
  if (current instanceof MainScreen) {
    return current;
  }
  return null;
}

function isGameReady(): boolean {
  const screen = getMainScreen();
  if (!screen) return false;
  return screen.gameManager !== undefined && screen.gameManager !== null;
}

if (import.meta.env.MODE === "test" || import.meta.env.VITE_ENABLE_GAME_TEST_API === "true") {
  window.__GAME_TEST__ = createGameTestApi(() => getMainScreen()?.gameManager ?? null, isGameReady);
  window.__GRID_VISUAL_TEST__ = createGridVisualTestApi();
}

// Mostrar versión en pantalla
const versionEl = document.getElementById("app-version");
if (versionEl) {
  versionEl.textContent = `v${APP_VERSION}`;
}
