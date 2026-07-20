import type { Plugin } from "vite";
import { defineConfig } from "vite";

function playwrightHarnessRoutes(): Plugin {
  return {
    name: "playwright-harness-routes",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?", 1)[0];

        if (pathname === "/__test__/health") {
          response.statusCode = 200;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ harness: "strategy-game-playwright", version: 1 }));
          return;
        }

        if (pathname === "/__test__/gameplay" || pathname === "/__test__/gameplay/") {
          request.url = "/tests/playwright/harness/gameplay.html";
        } else if (
          pathname === "/__test__/grid-renderer" ||
          pathname === "/__test__/grid-renderer/"
        ) {
          request.url = "/tests/playwright/harness/grid-renderer.html";
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [playwrightHarnessRoutes()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version ?? "0.0.0-test"),
  },
});
