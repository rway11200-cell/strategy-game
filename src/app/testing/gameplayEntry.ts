import "@pixi/sound";

import { Assets } from "pixi.js";
import { setEngine } from "../getEngine";
import { CreationEngine } from "../../engine/engine";
import { createGameTestApi } from "./GameTestApi";
import { GameplayTestRuntime } from "./GameplayTestRuntime";
import { ScenarioVisualHost } from "./ScenarioVisualHost";
import { createGameplayDebugPanel } from "./gameplayDebugPanel";

const rootElement = document.querySelector<HTMLElement>("[data-testid='game-test-root']");
if (!rootElement) throw new Error("Gameplay test root was not found");
const root: HTMLElement = rootElement;

const engine = new CreationEngine();
setEngine(engine);
let ready = false;

const visualHost = new ScenarioVisualHost(engine.stage);

const runtime = new GameplayTestRuntime(
  APP_VERSION,
  () => ({
    ready,
    surfaceCount: root.querySelectorAll("canvas").length,
    width: engine.canvas?.width ?? 0,
    height: engine.canvas?.height ?? 0,
    errors: [],
  }),
  visualHost,
);

async function bootstrapGameplayHarness(): Promise<void> {
  try {
    await engine.init({
      background: "#222222ff",
      resizeOptions: { minWidth: 768, minHeight: 1024, letterbox: false },
    });
    engine.ticker.stop();
    engine.canvas.dataset.testid = "game-test-canvas";

    await Assets.loadBundle("main");

    ready = true;
    const api = createGameTestApi(
      () => null,
      () => ready,
      runtime,
    );
    window.__GAME_TEST__ = api;

    const panel = createGameplayDebugPanel(api);
    root.appendChild(panel);

    root.dataset.harness = "strategy-game-playwright";
    root.dataset.state = "ready";

    window.addEventListener(
      "pagehide",
      () => {
        ready = false;
        delete window.__GAME_TEST__;
        engine.destroy(true, { children: true });
      },
      { once: true },
    );
  } catch (error) {
    root.dataset.state = "error";
    root.dataset.error = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

void bootstrapGameplayHarness();
