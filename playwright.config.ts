import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta. O Supabase é simulado em e2e/fake-supabase.ts: nada toca o banco real.
const PORT = 4317;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    // Testa como em produção: sem plano grátis, só entra quem assina.
    env: { VITE_BILLING_ENABLED: "true" },
    timeout: 120_000,
  },
});
