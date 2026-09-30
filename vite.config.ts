/// <reference types="vitest/config" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const root = import.meta.dirname
  const env = loadEnv(mode, root, "")
  // Dev only: the browser calls /api on the Vite origin and Vite forwards it to the
  // backend, so local development needs no CORS setup.
  const apiTarget = env.VITE_DEV_API_TARGET || "http://localhost:4000"

  return {
    root,
    plugins: [
      // Must run before the React plugin: it generates src/routeTree.gen.ts.
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routesDirectory: path.join(root, "src/routes"),
        generatedRouteTree: path.join(root, "src/routeTree.gen.ts"),
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(root, "./src"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/health": { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  }
})
