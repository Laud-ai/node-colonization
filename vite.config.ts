import { defineConfig } from "vite";

// SNAPSHOT=1 builds a frozen version into public/versions/<ver> (no nested public copy).
const snapshot = !!process.env.SNAPSHOT;

export default defineConfig({
  base: snapshot ? "./" : "/",
  publicDir: snapshot ? false : "public",
  server: { host: "0.0.0.0", port: 5174, strictPort: true },
  preview: { host: "0.0.0.0", port: 4174 },
});
