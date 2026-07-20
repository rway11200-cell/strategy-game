import { defineConfig } from "vite";
import { assetpackPlugin } from "./scripts/assetpack-vite-plugin";

const skipAssetPack = process.env.VITE_SKIP_ASSETPACK === "true";

export default defineConfig({
  plugins: skipAssetPack ? [] : [assetpackPlugin()],
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
    allowedHosts: true,
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
});
