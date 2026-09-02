import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
const appVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
  resolve: {
    alias: [
      {
        find: /^\.\/browser\/(DecodeContinuouslyCallback|HTMLVisualMediaElement)$/,
        replacement: resolve(import.meta.dirname, "src/shared/zxingTypeOnlyStub.js"),
      },
    ],
  },
  // @zxing/library publica dos reexports de tipos sin archivos JavaScript.
  // El bundle normal ya los redirige al stub de arriba; excluir ZXing del
  // prebundle evita que el servidor de desarrollo falle antes de usarlo.
  optimizeDeps: {
    exclude: ["@zxing/browser", "@zxing/library"],
  },
  ssr: {
    noExternal: ["@zxing/browser", "@zxing/library"],
  },
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
        precios: resolve(import.meta.dirname, "precios.html"),
      },
    },
  },
});
