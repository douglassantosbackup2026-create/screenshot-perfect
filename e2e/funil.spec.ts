import { expect, test } from "@playwright/test";
import { enterDemo, hydrated } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("landing: o começar leva ao cadastro", async ({ page }) => {
  await page.goto("/");
  await hydrated(page);
  await page.getByRole("button", { name: "Começar grátis" }).first().click();
  await expect(page).toHaveURL(/\/cadastro/);
  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
});

test("calculadora leva os números para o cadastro e o onboarding já vem preenchido", async ({ page }) => {
  await page.goto("/calculadora");
  await hydrated(page);
  await page.getByLabel("Quanto já tem guardado").fill("50000");
  await page.getByLabel("Quanto guarda por mês").fill("1500");
  await page.getByRole("button", { name: "Começar minha jornada" }).click();
  await expect(page).toHaveURL(/\/cadastro/);
  const prefill = await page.evaluate(() => JSON.parse(localStorage.getItem("calc_prefill") ?? "null"));
  expect(prefill).toMatchObject({ currentAge: 30, retirementAge: 60, desiredIncome: 8000, initialWealth: 50000, monthlyContribution: 1500 });

  // Sem conta, no modo demonstração: o onboarding pula o que já veio da calculadora.
  await enterDemo(page);
  await page.evaluate((p) => localStorage.setItem("calc_prefill", JSON.stringify(p)), prefill);
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Sua primeira estimativa" })).toBeVisible();
  await page.getByRole("button", { name: "Salvar plano e começar" }).click();
  await expect(page).toHaveURL(/\/hoje/);
});

test("telas do app sem conta e sem modo demonstração levam para entrar", async ({ page }) => {
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/entrar/);
});
