import { expect, test } from "@playwright/test";
import { enterDemo } from "./helpers";

test("fechamento do mês: do 4 de 5 ao mês fechado", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await enterDemo(page);
  await expect(page.getByRole("region", { name: "Fechamento do mês" })).toContainText("4 de 5");

  await page.goto("/fechamento");
  await expect(page.getByText("4 de 5")).toBeVisible();
  await page.getByRole("button", { name: "Não consegui este mês" }).click();
  const close = page.getByRole("button", { name: /^Fechar \w+ \(\+50 XP\)$/ });
  await expect(close).toBeEnabled();
  await close.click();
  await expect(page.getByText(/está fechado\./)).toBeVisible();

  await page.goto("/hoje");
  await expect(page.getByRole("region", { name: "Fechamento do mês" })).toContainText("fechado");
});
