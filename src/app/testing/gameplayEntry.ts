import "@pixi/sound";

import { setEngine } from "../getEngine";
import { CreationEngine } from "../../engine/engine";
import { createGameTestApi } from "./GameTestApi";

const rootElement = document.querySelector<HTMLElement>("[data-testid='game-test-root']");
if (!rootElement) throw new Error("Gameplay test root was not found");
const root: HTMLElement = rootElement;

const engine = new CreationEngine();
setEngine(engine);

async function bootstrapGameplayHarness(): Promise<void> {
  try {
    await engine.init({
      background: "#222222ff",
      resizeOptions: { minWidth: 768, minHeight: 1024, letterbox: false },
    });
    engine.ticker.stop();
    engine.canvas.dataset.testid = "game-test-canvas";

    let ready = true;
    window.__GAME_TEST__ = createGameTestApi(
      () => null,
      () => ready,
    );
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
