import { initDevtools } from "@pixi/devtools";
import { setEngine } from "./app/getEngine";
import { LoadScreen } from "./app/screens/LoadScreen";
import { MainScreen } from "./app/screens/main/MainScreen";
import { userSettings } from "./app/utils/userSettings";
import { CreationEngine } from "./engine/engine";

/**
 * Importing these modules will automatically register there plugins with the engine.
 */
import "@pixi/sound";
// import "@esotericsoftware/spine-pixi-v8";

// Create a new creation engine instance

const engine = new CreationEngine();

initDevtools({ app: engine });
setEngine(engine);

const gameRoot = document.querySelector<HTMLElement>("[data-testid='game-root']");

void (async () => {
  try {
    // Initialize the creation engine instance
    await engine.init({
      background: "#333333ff",
      resizeOptions: { minWidth: 768, minHeight: 1024, letterbox: false },
    });
    engine.canvas.dataset.testid = "game-canvas";

    // Initialize the user settings
    userSettings.init();

    // Show the load screen
    await engine.navigation.showScreen(LoadScreen);
    // Show the main screen once the load screen is dismissed
    await engine.navigation.showScreen(MainScreen);
    if (gameRoot) gameRoot.dataset.state = "ready";
  } catch (error) {
    if (gameRoot) {
      gameRoot.dataset.state = "error";
      gameRoot.dataset.error = error instanceof Error ? error.message : String(error);
    }
    throw error;
  }
})();

// Mostrar versión en pantalla
const versionEl = document.getElementById("app-version");
if (versionEl) {
  versionEl.textContent = `v${APP_VERSION}`;
}
