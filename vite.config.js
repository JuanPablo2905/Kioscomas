import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: [".trycloudflare.com", ".ts.net"],
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: [".trycloudflare.com", ".ts.net"],
  },
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, "index.html"),
        landing: resolve(import.meta.dirname, "landing.html"),
      },
    },
  },
});
