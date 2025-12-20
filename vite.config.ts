import { defineConfig } from "vite";
import { assetpackPlugin } from "./scripts/assetpack-vite-plugin";

export default defineConfig({
  plugins: [assetpackPlugin()],
  server: {
    port: 8080,
    open: false,
  },
  build: {
    sourcemap: true,
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: [
      "tower-defence-pixi-production.up.railway.app", // tu dominio real
      "localhost", // útil si haces pruebas locales
    ],
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
});
