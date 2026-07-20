import { expect, test as base } from "@playwright/test";
import { GameTestDriver } from "./GameTestDriver";

export const test = base.extend<{ game: GameTestDriver }>({
  game: async ({ page }, use) => {
    const game = new GameTestDriver(page);
    try {
      await use(game);
    } finally {
      await game.cleanupStartedScenarios();
    }
  },
});

export { expect };
