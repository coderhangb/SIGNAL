import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

Object.assign(
  process.env,
  loadEnv("development", path.resolve(import.meta.dirname, "../.."), ""),
);
const port = Number(process.env.FE_PORT || 5173);
const proxy = {
  "/api": {
    target: `http://127.0.0.1:${process.env.API_PORT || 3000}`,
    changeOrigin: false,
  },
};
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((module) =>
            module.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((module) =>
            module.devBanner(),
          ),
        ]
      : []),
  ],
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy,
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
  },
  preview: { proxy, port, host: "0.0.0.0", allowedHosts: true },
});
