import { defineConfig } from "vite";

// SNAPSHOT=1 builds a frozen version into public/versions/<ver> (no nested public copy).
const snapshot = !!process.env.SNAPSHOT;

// GitHub Pages project site: https://laud-ai.github.io/node-colonization/
// Local `vite` / `npm run dev` stays at "/".
// `vite build` and `vite preview` use the Pages base (preview is also command "serve").
export default defineConfig(({ command, isPreview }) => ({
  base: snapshot
    ? "./"
    : command === "build" || isPreview
      ? "/node-colonization/"
      : "/",
  publicDir: snapshot ? false : "public",
  server: { host: "0.0.0.0", port: 5174, strictPort: true },
  preview: { host: "0.0.0.0", port: 4174 },
}));
