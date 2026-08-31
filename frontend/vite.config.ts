import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(frontendDir, "src");

export default defineConfig({
  root: frontendDir,
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\//, replacement: sourceDir + "/" }],
  },
  css: {
    postcss: path.resolve(frontendDir, "postcss.config.mjs"),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
  build: {
    outDir: path.resolve(frontendDir, "dist"),
    emptyOutDir: true,
  },
});
