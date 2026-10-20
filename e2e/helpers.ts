import { expect, type Page } from "@playwright/test";

/** Páginas públicas vêm prontas do servidor: espera o React assumir antes de clicar. */
export async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector("main button, main a, main form");
    return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
  });
}

/** Entra no modo demonstração com os dados de exemplo (Ana) e abre a Jornada. */
export async function enterDemo(page: Page) {
  await page.goto("/entrar");
  await hydrated(page);
  await page.getByRole("button", { name: "Experimentar sem conta" }).click();
  await expect(page).toHaveURL(/\/hoje/);
  await expect(page.getByRole("heading", { name: /Olá, Ana/ })).toBeVisible();
}

/** Fecha painéis abertos (tela de importação, comemoração de conquista) com Esc. */
export async function closeDialogs(page: Page) {
  for (let i = 0; i < 4 && (await page.getByRole("dialog").count()) > 0; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
