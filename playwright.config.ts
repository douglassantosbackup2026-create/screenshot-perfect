import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta no navegador (npm run e2e). Usam o Chrome instalado (channel "chrome"), sem baixar navegadores.
// Rodam no modo demonstração: não precisam de conta nem gravam no banco.
const PORT = 5175;

export default defineConfig({
  testDir: "./e2e",
  // A primeira visita a cada página compila no Vite: dá margem e roda um teste por vez.
  timeout: 180_000,
  workers: 1,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 }, channel: "chrome" } },
  ],
  webServer: {
    command: `npx vite dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
  },
});
