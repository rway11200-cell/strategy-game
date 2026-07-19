import { defineConfig } from "vite";
import { assetpackPlugin } from "./scripts/assetpack-vite-plugin";

export default defineConfig({
  plugins: [assetpackPlugin()],
  server: {
    port: 8080,
    open: false,
    allowedHosts: [
      "tower-defence-pixi-production.up.railway.app",
      "strategy-game-production-0277.up.railway.app",
      "localhost",
    ],
  },
  build: {
    sourcemap: true,
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: [
      "tower-defence-pixi-production.up.railway.app",
      "strategy-game-production-0277.up.railway.app",
      "localhost",
    ],
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
});
