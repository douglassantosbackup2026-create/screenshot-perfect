import { expect, test } from "@playwright/test";
import { closeDialogs, enterDemo } from "./helpers";

const ofx = (date: string) => `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>${date}
<TRNAMT>-89.90
<FITID>E2E-1
<MEMO>UBER *TRIP HELP.UBER.COM
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>${date}
<TRNAMT>-120.00
<FITID>E2E-2
<MEMO>FARMACIA SAO JOAO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

test("importa OFX, aplica as regras e não duplica ao importar de novo", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await enterDemo(page);
  await page.goto("/diario");
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const file = { name: "extrato.ofx", mimeType: "application/x-ofx", buffer: Buffer.from(ofx(today)) };

  const importOnce = async () => {
    await page.getByRole("button", { name: "Importar" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#import-file").setInputFiles(file);
    await expect(dialog).toContainText("2 lançamentos encontrados");
    await expect(dialog).toContainText("Formato reconhecido: OFX");
    await dialog.getByRole("button", { name: "Importar" }).click();
  };

  await importOnce();
  await expect(page.getByText("Extrato importado: 2 novos")).toBeVisible();
  // A primeira importação desbloqueia a conquista "Extrato importado", que abre a comemoração por cima.
  await expect(page.getByRole("dialog")).toContainText("Extrato importado");
  await closeDialogs(page);
  await expect(page.getByRole("region", { name: "Lançamentos" })).toContainText("FARMACIA SAO JOAO");

  await importOnce();
  await closeDialogs(page);
  await expect(page.getByText(/Extrato importado: 0 novos, 2 já estavam importados/)).toBeVisible();
});
