import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryDir = path.resolve(frontendDir, "..");

export default defineConfig({
  root: frontendDir,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@/i18n/routing",
        replacement: path.resolve(frontendDir, "src/runtime/routing.ts"),
      },
      {
        find: "next-intl",
        replacement: path.resolve(frontendDir, "src/runtime/i18n-runtime.tsx"),
      },
      {
        find: "next/navigation",
        replacement: path.resolve(frontendDir, "src/runtime/navigation.ts"),
      },
      {
        find: "next/link",
        replacement: path.resolve(frontendDir, "src/runtime/link.tsx"),
      },
      {
        find: /^@\//,
        replacement: repositoryDir + "/",
      },
    ],
  },
  css: {
    postcss: path.resolve(repositoryDir, "postcss.config.mjs"),
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
