import { expect, test } from "@playwright/test";
import { makeSeed } from "../src/lib/data/demo-store";
import { profileOf, signIn, transactionsOf } from "./fake-supabase";

test("logada, o botão da landing abre o app sem apagar os dados", async ({ page }) => {
  const db = await signIn(page, makeSeed());
  await page.goto("/");
  const cta = page.getByRole("button", { name: "Abrir o app" }).first();
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByRole("heading", { name: /Olá, Ana/ })).toBeVisible();
  expect(profileOf(db)?.displayName).toBe("Ana");
});

test("onboarding já feito não abre de novo", async ({ page }) => {
  await signIn(page, makeSeed());
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/hoje$/);
});

test("o + lança um gasto na tela atual, preenchido por frase, e grava no banco", async ({ page }) => {
  const db = await signIn(page, makeSeed());
  const before = transactionsOf(db).length;
  await page.goto("/patrimonio");
  await page.getByRole("button", { name: "Registrar" }).last().click();
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  await page.getByLabel("Lançar por frase").fill("gastei 62 na farmácia");
  await page.getByRole("button", { name: "Preencher" }).click();
  await page.getByRole("button", { name: "Lançar", exact: true }).click();
  await expect(page).toHaveURL(/\/patrimonio$/);
  await expect.poll(() => transactionsOf(db).length).toBe(before + 1);
  expect(transactionsOf(db).at(-1)).toMatchObject({ amount: -6200 });
});

test("admin de conteúdo é bloqueado para quem não é admin", async ({ page }) => {
  await signIn(page, makeSeed());
  await page.goto("/admin/conteudo");
  await expect(page).toHaveURL(/\/hoje$/);
});

test("o registro do patrimônio fica no Patrimônio; links antigos do Progresso levam para lá", async ({ page }) => {
  await signIn(page, makeSeed());
  await page.goto("/evolucao?registrar=true");
  await expect(page).toHaveURL(/\/patrimonio$/);
  await expect(page.getByRole("heading", { name: /Patrimônio de / })).toBeVisible();
});

test("edição não salva do plano sobrevive a um lançamento feito pelo +", async ({ page }) => {
  await signIn(page, makeSeed());
  await page.goto("/plano");
  await page.getByRole("button", { name: "Premissas" }).click();
  await page.getByRole("spinbutton", { name: "Aporte mensal" }).fill("4321");
  await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Registrar" }).last().click();
  await page.getByRole("button", { name: /Novo lançamento/ }).click();
  await page.getByRole("spinbutton", { name: "Valor" }).fill("10");
  await page.getByRole("textbox", { name: "Descrição" }).fill("Padaria");
  await page.getByRole("button", { name: "Lançar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(page.getByRole("spinbutton", { name: "Aporte mensal" })).toHaveValue(/4\.?321/);
  await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
});

test("página de privacidade é pública", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { name: "Privacidade" })).toBeVisible();
});

test("sem conta, 'Começar grátis' leva ao cadastro, não ao login", async ({ page }) => {
  await page.goto("/");
  // O botão já vem no HTML do servidor; espera a página ligar os cliques.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Começar grátis" }).first().click();
  await expect(page).toHaveURL(/\/cadastro\?redirect=%2Fonboarding/);
  await expect(page.getByRole("heading", { name: /Criar conta grátis|Salve seu plano/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible();
});

test("a landing apresenta o Mitikos como orçamento, patrimônio e aposentadoria num app só", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/^Mitikos — /);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("num app só");
  const threeInOne = page.getByRole("region", { name: "Três apps em um" });
  for (const pillar of ["Orçamento", "Patrimônio", "Aposentadoria"]) await expect(threeInOne.getByText(pillar, { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Calculadora rápida" })).toContainText("Quanto falta para você se aposentar?");
});

test("conta nova: boas-vindas com os três pilares, onboarding de 4 etapas e Início com número do mês, próximo passo e checklist", async ({ page }) => {
  const db = await signIn(page, null);
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Boas-vindas ao Mitikos" })).toBeVisible();
  for (const pillar of ["Orçamento", "Patrimônio", "Aposentadoria"]) await expect(page.getByText(pillar, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Começar" }).click();
  await page.getByLabel("Como você quer ser chamado?").fill("Bia");
  await page.getByRole("spinbutton", { name: /Ano de nascimento/ }).fill("1994");
  await expect(page.getByText("1/4")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click(); // aposentar aos 60
  await page.getByRole("spinbutton", { name: "Renda mensal desejada" }).fill("6000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("spinbutton", { name: "Patrimônio atual para a aposentadoria" }).fill("10000");
  await page.getByRole("spinbutton", { name: "Aporte mensal previsto" }).fill("500");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Salvar meu plano" }).click();

  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByRole("region", { name: "Seu mês" })).toContainText("Seu plano pede guardar");
  await expect(page.getByRole("region", { name: "Próximo passo" })).toContainText("Registre o aporte deste mês");
  await expect(page.getByRole("region", { name: "Primeiros passos" })).toContainText("0 de 3");
  await expect(page.getByRole("heading", { name: "Seu mês: 0 de 2" })).toBeVisible();
  await expect.poll(() => (db.row?.data as { profile?: { displayName?: string } } | undefined)?.profile?.displayName).toBe("Bia");
});

test("as três frentes pelo menu: Dinheiro, Futuro e Progresso, com o nome do menu no título", async ({ page }) => {
  await signIn(page, makeSeed());
  await page.goto("/hoje");
  const nav = page.locator('nav[aria-label="Navegação principal"]:visible');
  const go = async (link: string, url: RegExp, title: string) => {
    await page.getByRole("link", { name: link, exact: true }).first().click();
    await expect(page).toHaveURL(url);
    await expect(page).toHaveTitle(`${title} — Mitikos`);
  };

  await nav.getByRole("link", { name: "Dinheiro" }).click();
  await expect(page).toHaveURL(/\/diario$/);
  await expect(page).toHaveTitle("Lançamentos — Mitikos");
  await go("Orçamento", /\/orcamento$/, "Orçamento");
  await go("Contas", /\/contas$/, "Contas");

  await nav.getByRole("link", { name: "Futuro" }).click();
  await expect(page).toHaveURL(/\/plano$/);
  await expect(page).toHaveTitle("Plano — Mitikos");
  await go("Patrimônio", /\/patrimonio$/, "Patrimônio");

  await nav.getByRole("link", { name: "Progresso" }).click();
  await expect(page).toHaveURL(/\/evolucao$/);
  await expect(page).toHaveTitle("Progresso — Mitikos");
});

test("/planos mostra o que é grátis para sempre e a lista de espera do Inteligência", async ({ page }) => {
  await signIn(page, makeSeed());
  await page.goto("/planos");
  await expect(page.getByText("Grátis para sempre")).toBeVisible();
  await expect(page.getByText(/Lançamento:/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Quero ser avisado" })).toBeVisible();
});

test("no celular, todo botão visível tem pelo menos 44px de altura", async ({ page }) => {
  await signIn(page, makeSeed());
  const small: string[] = [];
  for (const path of ["/hoje", "/fechamento", "/plano", "/evolucao"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const b of await page.getByRole("button").all()) {
      if (!(await b.isVisible())) continue;
      const box = await b.boundingBox();
      if (box && box.height < 43.5) small.push(`${path}: "${(await b.innerText()).trim() || (await b.getAttribute("aria-label"))}" (${Math.round(box.height)}px)`);
    }
  }
  expect(small).toEqual([]);
});
