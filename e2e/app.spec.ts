import { expect, test } from "@playwright/test";
import { makeSeed } from "../src/lib/data/demo-store";
import { ACTIVE, profileOf, signIn, transactionsOf } from "./fake-supabase";

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

test("sem conta, 'Assinar o Mitikos' leva ao cadastro, não ao login", async ({ page }) => {
  await page.goto("/");
  // O botão já vem no HTML do servidor; espera a página ligar os cliques.
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/grátis/i).filter({ hasNotText: "Tem plano grátis?" })).toHaveCount(0);
  await page.getByRole("button", { name: "Assinar o Mitikos" }).first().click();
  await expect(page).toHaveURL(/\/cadastro\?redirect=%2Fonboarding/);
  await expect(page.getByRole("heading", { name: /^Criar conta$|Salve seu plano/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible();
});

test("sem assinatura, o app leva à Assinatura e esconde o menu; o Perfil continua aberto", async ({ page }) => {
  await signIn(page, makeSeed(), { entitlement: null });
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/planos$/);
  await expect(page.getByRole("heading", { name: "Assine para usar o Mitikos" })).toBeVisible();
  await expect(page.getByText("Seus dados estão guardados. Assine para voltar a usar.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Assinar mensal/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Assinar anual/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);

  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/perfil$/);
  await page.goto("/diario");
  await expect(page).toHaveURL(/\/planos$/);
});

test("assinatura vencida também leva à Assinatura", async ({ page }) => {
  await signIn(page, makeSeed(), { entitlement: { plan: "inteligencia", valid_until: "2020-01-01T00:00:00Z" } });
  await page.goto("/plano");
  await expect(page).toHaveURL(/\/planos$/);
});

test("conta nova: assina, a volta do Mercado Pago confirma e segue para o onboarding", async ({ page }) => {
  const db = await signIn(page, null, { entitlement: null });
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/planos$/);
  await expect(page.getByRole("heading", { name: "Assine para usar o Mitikos" })).toBeVisible();

  // O webhook do Mercado Pago grava a assinatura enquanto a pessoa volta para /pagamento.
  await page.goto("/pagamento");
  await expect(page.getByRole("heading", { name: "Confirmando sua assinatura…" })).toBeVisible();
  db.entitlement = ACTIVE;
  await expect(page.getByRole("heading", { name: "Assinatura confirmada" })).toBeVisible();
  await page.getByRole("link", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Boas-vindas ao Mitikos" })).toBeVisible();
});

test("se a consulta da assinatura falha, não libera o app (falha fechado)", async ({ page }) => {
  const db = await signIn(page, makeSeed());
  db.entitlementDown = true;
  // Mesmo com um status "ativo" forjado no aparelho.
  await page.addInitScript(() =>
    window.localStorage.setItem("mitikos_access_00000000-0000-4000-8000-0000000000e2", JSON.stringify({ tier: "pro", active: true, billingOff: false })),
  );
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/planos$/);
});

test("admin entra sem assinatura", async ({ page }) => {
  await signIn(page, makeSeed(), { entitlement: null, admin: true });
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/hoje$/);
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

test("/planos para quem assina: sem plano grátis, sem botão de assinar e o Pro na lista de espera", async ({ page }) => {
  await signIn(page, makeSeed());
  await page.goto("/planos");
  await expect(page.getByRole("heading", { name: "Assinatura", exact: true })).toBeVisible();
  await expect(page.getByText(/grátis/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Assinar mensal/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Plano Pro" }).getByRole("button", { name: "Quero ser avisado" })).toBeVisible();
});

test("no celular, todo botão visível tem pelo menos 44px de altura", async ({ page }) => {
  await signIn(page, makeSeed());
  const small: string[] = [];
  for (const path of ["/hoje", "/fechamento", "/plano", "/evolucao", "/planos"]) {
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
