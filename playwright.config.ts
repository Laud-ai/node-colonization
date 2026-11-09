import { defineConfig } from "@playwright/test";

// Production preview serves under Vite base `/node-colonization/`.
const BASE = "/node-colonization/";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:4174${BASE}`,
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4174",
    url: `http://127.0.0.1:4174${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
