import { createGridVisualTestApi } from "./GridVisualTestApi";

const root = document.querySelector<HTMLElement>("[data-testid='grid-test-root']");
if (!root) throw new Error("Grid visual test root was not found");

window.__GRID_VISUAL_TEST__ = createGridVisualTestApi();
root.dataset.state = "ready";

window.addEventListener(
  "pagehide",
  () => {
    delete window.__GRID_VISUAL_TEST__;
  },
  { once: true },
);
