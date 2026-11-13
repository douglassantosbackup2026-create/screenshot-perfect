// Painel administrativo: menu por perfil, cada módulo abre sem erro (celular e desktop), analista sem botões
// de alterar, quem não é da equipe não entra, e o atendimento de ponta a ponta (pessoa pergunta, equipe responde).
import { expect, test, type Page } from "@playwright/test";
import { makeSeed } from "../src/lib/data/demo-store";
import { POLICY_VERSION } from "../src/lib/analytics/analytics";
import { MODULES } from "../src/lib/admin/modules";
import { signIn } from "./fake-supabase";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (v) => window.localStorage.setItem("mk_consent", JSON.stringify({ choice: "recusado", version: v, at: "2026-01-01T00:00:00Z" })),
    POLICY_VERSION,
  );
});

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Report Only|Content Security Policy|Failed to load resource|net::ERR|status of 40[34]/i.test(t)) return;
    errors.push(t);
  });
  return errors;
}

async function noHorizontalScroll(page: Page, where: string) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra, `rolagem horizontal em ${where}`).toBeLessThanOrEqual(1);
}

for (const width of [375, 1440])
  test(`super admin: todos os ${MODULES.length} módulos abrem sem erro em ${width}px`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 900 });
    const errors = watchErrors(page);
    await signIn(page, makeSeed(), { admin: true });
    for (const m of MODULES) {
      await page.goto(m.path);
      await expect(page).toHaveURL(new RegExp(`${m.path}$`));
      await expect(page.locator("main h1").last()).toBeVisible();
      await expect(page.getByLabel("Carregando"), `carregando sem fim em ${m.path}`).toHaveCount(0);
      await noHorizontalScroll(page, `${width}px ${m.path}`);
      if (process.env["AUDIT_SHOTS"]) await page.screenshot({ path: `${process.env["AUDIT_SHOTS"]}/admin-${width}${m.path.replace(/\//g, "_")}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });

test("visão geral responde às três perguntas com os números do banco", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, makeSeed(), { admin: true });
  await page.goto("/admin");
  for (const q of ["A plataforma está crescendo?", "As pessoas estão usando?", "Estamos gerando oportunidades?"])
    await expect(page.getByRole("heading", { name: q })).toBeVisible();
  await expect(page.getByText("1.200")).toBeVisible(); // visitas
  await expect(page.getByText("+20%").first()).toBeVisible(); // 1.200 contra 1.000
  await expect(page.getByLabel("Alertas")).toContainText("incidente");
  // Menu lateral com todos os módulos.
  const nav = page.getByRole("complementary", { name: "Seções do painel" });
  for (const m of MODULES) await expect(nav.getByRole("link", { name: m.title, exact: true })).toBeVisible();
});

test("analista: só os módulos de leitura, sem botões de alterar, e URL direta de módulo proibido volta ao painel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, makeSeed(), { staff: ["analista"] });
  await page.goto("/admin");
  const nav = page.getByRole("complementary", { name: "Seções do painel" });
  await expect(nav.getByRole("link", { name: "Uso das funcionalidades" })).toBeVisible();
  for (const hidden of ["Segurança", "Configurações", "Atendimento", "Preços", "Leads"])
    await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
  await page.goto("/admin/seguranca");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/assinaturas");
  await expect(page.getByRole("button", { name: "Conferir o período" })).toHaveCount(0);
  await expect(page.getByText("Só o financeiro roda a conciliação.")).toBeVisible();
});

test("quem não é da equipe não entra no painel nem vê o link no Perfil", async ({ page }) => {
  await signIn(page, makeSeed());
  await page.goto("/perfil");
  await expect(page.getByRole("link", { name: "Painel administrativo" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/hoje$/);
});

test("atendimento: a pessoa pergunta no Perfil, a equipe responde no painel e a resposta aparece no Perfil", async ({ page }) => {
  await signIn(page, makeSeed(), { admin: true });
  await page.goto("/perfil");
  const support = page.getByRole("region", { name: "Fale conosco" });
  await support.getByLabel("Resumo").fill("Como exporto meus dados?");
  await support.getByLabel("Mensagem").fill("Não achei o botão.");
  await support.getByRole("button", { name: "Enviar" }).click();
  await expect(support.getByText("Como exporto meus dados?")).toBeVisible();

  await page.goto("/admin/atendimento");
  await page.getByRole("button", { name: /Como exporto meus dados\?/ }).click();
  await page.getByLabel("Responder").fill("Em Perfil, “Baixar meus dados”.");
  await page.getByRole("button", { name: "Enviar resposta" }).click();
  await expect(page.getByText("Resposta enviada.")).toBeVisible();

  await page.goto("/perfil");
  await support.getByRole("button", { name: /Como exporto meus dados\?/ }).click();
  await expect(support.getByText("Em Perfil, “Baixar meus dados”.")).toBeVisible();
  await expect(support.getByText(/Equipe ·/)).toBeVisible();
});

test("contato público abre sem conta", async ({ page }) => {
  await page.goto("/contato");
  await expect(page.getByRole("heading", { name: "Fale com a equipe" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
});

test("novo cadastro: só o super admin vê; senha temporária gerada e validada; cortesia ou link, não os dois", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, makeSeed(), { admin: true });
  await page.goto("/admin/usuarios");
  await page.getByRole("button", { name: "Novo cadastro" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo cadastro" });
  const pass = dialog.getByLabel("Senha temporária");
  const first = await pass.inputValue();
  expect(first).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{14}$/);
  await dialog.getByRole("button", { name: "Gerar outra senha" }).click();
  await expect(pass).not.toHaveValue(first);

  // Acesso ao plano: escolher um desmarca o outro.
  const access = dialog.getByRole("radiogroup", { name: "Acesso ao plano" });
  await access.getByRole("radio", { name: "Cortesia" }).click();
  await access.getByRole("radio", { name: "Link de assinatura" }).click();
  await expect(access.getByRole("radio", { name: "Cortesia" })).toHaveAttribute("aria-checked", "false");
  await expect(access.getByRole("radio", { name: "Link de assinatura" })).toHaveAttribute("aria-checked", "true");

  // Validação antes de chamar o servidor.
  await dialog.getByLabel("Nome").fill("Maria Souza");
  await dialog.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await dialog.getByLabel("E-mail").fill("maria@exemplo.com");
  await pass.fill("fraca");
  await dialog.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Use pelo menos 8 caracteres.")).toBeVisible();

  // Afiliado: código sugerido pelo nome e prévia da comissão.
  await dialog.getByLabel("Já cadastrar como parceiro aprovado").check();
  await expect(dialog.getByLabel("Código")).toHaveAttribute("placeholder", /^MARIA\d{2}$/);
  await expect(dialog.getByText(/de cada pagamento/)).toBeVisible();
});

test("financeiro vê usuários, mas não o novo cadastro", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, makeSeed(), { staff: ["financeiro"] });
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo cadastro" })).toHaveCount(0);
});

test("conta criada pelo painel: só o Perfil abre até trocar a senha temporária", async ({ page }) => {
  await signIn(page, makeSeed(), { userMetadata: { must_change_password: true } });
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/perfil/);
  const box = page.getByRole("region", { name: "Defina sua senha" });
  await expect(box).toBeVisible();
  await expect(box.getByLabel("Senha temporária")).toBeVisible();
  await expect(box.getByRole("button", { name: "Cancelar" })).toHaveCount(0);
  await page.goto("/plano");
  await expect(page).toHaveURL(/\/perfil/);
});
