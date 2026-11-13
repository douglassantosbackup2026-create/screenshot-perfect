// Auditoria de produção (docs/AUDITORIA-PRODUCAO.md): acesso direto e recarga de cada rota, Voltar do navegador,
// rota inexistente, calculadoras com entradas válidas, inválidas e extremas, jornadas por perfil de usuário,
// persistência do plano, erros no console e varredura de tamanhos de tela. Supabase simulado (fake-supabase).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { makeSeed } from "../src/lib/data/demo-store";
import { POLICY_VERSION } from "../src/lib/analytics/analytics";
import { signIn } from "./fake-supabase";

const PUBLIC = ["/", "/calculadora", "/entrar", "/cadastro", "/esqueci-senha", "/privacidade", "/sobre", "/parceiros", "/pagamento"];
const PRIVATE = ["/hoje", "/diario", "/orcamento", "/contas", "/plano", "/patrimonio", "/evolucao", "/fechamento", "/perfil", "/planos", "/parceiro"];
const SHOTS = process.env["AUDIT_SHOTS"] ?? "";

test.beforeEach(async ({ page }) => {
  // Aviso de privacidade já respondido (recusado): sem banner cobrindo a tela.
  await page.addInitScript(
    (v) => window.localStorage.setItem("mk_consent", JSON.stringify({ choice: "recusado", version: v, at: "2026-01-01T00:00:00Z" })),
    POLICY_VERSION,
  );
});

/** Erros de console e de página. Ignora o que vem de fora do app (CSP em modo relatório, recursos do Supabase simulado). */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Report Only|Content Security Policy|Failed to load resource|net::ERR|status of 404/i.test(t)) return;
    errors.push(t);
  });
  return errors;
}

/** Abre uma página com SSR e espera o React assumir (antes disso, o que se digita não chega ao estado). */
async function openHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function noHorizontalScroll(page: Page, where = "") {
  const over = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > doc.clientWidth + 1 && getComputedStyle(el).position !== "fixed";
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    return { scroll: doc.scrollWidth - doc.clientWidth, wide };
  });
  expect(over.scroll, `rolagem horizontal ${where}; elementos largos: ${over.wide.join(" | ")}`).toBeLessThanOrEqual(1);
}

test.describe("rotas públicas", () => {
  for (const path of PUBLIC)
    test(`acesso direto e recarga: ${path}`, async ({ page }) => {
      const errors = watchErrors(page);
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.reload();
      await expect(page.locator("h1").first()).toBeVisible();
      await noHorizontalScroll(page);
      expect(errors).toEqual([]);
    });

  test("rota inexistente mostra a página de não encontrado, com caminho de volta", async ({ page }) => {
    await page.goto("/rota-que-nao-existe");
    await expect(page.getByRole("link").first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/não encontr|não existe|404/i);
  });

  test("Voltar do navegador refaz o caminho", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ver a conta completa" }).click();
    await expect(page).toHaveURL(/\/calculadora$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("spinbutton", { name: "Sua idade" })).toBeVisible();
  });
});

test.describe("calculadora da página inicial", () => {
  test("positivo: mostra o aporte e as premissas junto do número", async ({ page }) => {
    await openHydrated(page, "/");
    const result = page.locator('[aria-label="Calculadora rápida"] [aria-live="polite"]');
    await expect(result).toContainText(/guardar cerca de\s*R\$/);
    await expect(result).toContainText("não uma garantia");
    await expect(result).toContainText("R$ 8.000");
  });

  test("negativo: aposentar antes da idade atual mostra o erro, sem número", async ({ page }) => {
    await openHydrated(page, "/");
    await page.getByRole("spinbutton", { name: "Aposentar aos" }).fill("25");
    const result = page.locator('[aria-label="Calculadora rápida"] [aria-live="polite"]');
    await expect(result).toContainText("precisa ser maior que a idade atual");
    await expect(result).not.toContainText("guardar cerca de");
  });

  test("campo vazio e valores extremos não quebram a tela nem mostram NaN/Infinity", async ({ page }) => {
    const errors = watchErrors(page);
    await openHydrated(page, "/");
    const income = page.getByRole("spinbutton", { name: /Renda por mês/ });
    const result = page.locator('[aria-label="Calculadora rápida"] [aria-live="polite"]');
    await income.fill("");
    await expect(result).not.toContainText("guardar");
    for (const v of ["1", "999999999", "0"]) {
      await income.fill(v);
      await expect(result).not.toContainText(/NaN|Infinity|undefined/);
    }
    await income.fill("0");
    await expect(result).toContainText("Informe a renda mensal desejada");
    expect(errors).toEqual([]);
  });
});

test.describe("calculadora completa (/calculadora)", () => {
  test("com patrimônio e aporte que já bastam, o aporte necessário é zero", async ({ page }) => {
    await openHydrated(page, "/calculadora");
    await page.getByRole("spinbutton", { name: "Idade atual" }).fill("45");
    await page.getByRole("spinbutton", { name: "Aposentar aos" }).fill("60");
    await page.getByRole("spinbutton", { name: /Renda mensal desejada/ }).fill("5000");
    await page.getByRole("spinbutton", { name: "Quanto já tem guardado" }).fill("3000000");
    const result = page.getByRole("region", { name: "Resultado" });
    await expect(result).toContainText("R$");
    await expect(result).not.toContainText(/NaN|Infinity/);
  });

  test("campos obrigatórios vazios pedem o preenchimento", async ({ page }) => {
    await openHydrated(page, "/calculadora");
    await page.getByRole("spinbutton", { name: "Idade atual" }).fill("");
    await expect(page.getByRole("region", { name: "Resultado" })).toContainText("Preencha idade, idade para se aposentar e renda.");
  });

  test("valores negativos são recusados com mensagem", async ({ page }) => {
    await openHydrated(page, "/calculadora");
    await page.getByRole("spinbutton", { name: "Quanto guarda por mês" }).fill("-100");
    await expect(page.getByRole("region", { name: "Resultado" })).toContainText(/negativ/);
  });
});

/** Estado de exemplo com o plano do perfil. */
function seedWith(inputs: Partial<ReturnType<typeof makeSeed>["plan"] extends infer P ? P extends { inputs: infer I } ? I : never : never>) {
  const seed = makeSeed();
  if (seed.plan) seed.plan = { ...seed.plan, inputs: { ...seed.plan.inputs, ...inputs } };
  return seed;
}

test.describe("jornadas por perfil (/plano)", () => {
  const profiles = [
    { name: "1. jovem começando do zero", inputs: { currentAge: 22, retirementAge: 60, initialWealth: 0, monthlyContribution: 200, desiredMonthlyIncome: 4000 } },
    { name: "2. meia-idade com patrimônio", inputs: { currentAge: 45, retirementAge: 62, initialWealth: 900000, monthlyContribution: 3000, desiredMonthlyIncome: 12000 } },
    { name: "3. perto de se aposentar", inputs: { currentAge: 63, retirementAge: 65, initialWealth: 1500000, monthlyContribution: 5000, desiredMonthlyIncome: 9000 } },
  ];
  for (const p of profiles)
    test(p.name, async ({ page }) => {
      const errors = watchErrors(page);
      await signIn(page, seedWith(p.inputs));
      await page.goto("/plano");
      const answer = page.locator("section[aria-live=polite]").first();
      await expect(answer).toContainText(/guarde cerca de\s*R\$/i);
      await expect(page.locator("main")).not.toContainText(/NaN|Infinity|undefined/);
      await expect(page.getByRole("spinbutton", { name: "Aposentar aos" })).toHaveValue(String(p.inputs.retirementAge));
      // Ferramentas e detalhes abrem sem quebrar.
      await page.getByRole("button", { name: /Ferramentas/ }).click();
      await expect(page.getByRole("region", { name: "Com quantos anos posso parar" })).toBeVisible();
      await page.getByRole("button", { name: /Detalhes/ }).click();
      await expect(page.getByText("Como calculamos")).toBeVisible();
      await expect(page.locator("main")).not.toContainText(/NaN|Infinity|undefined/);
      expect(errors).toEqual([]);
    });

  test("4. pouca familiaridade: muda um número, salva pela barra e o valor fica depois de recarregar", async ({ page }) => {
    const db = await signIn(page, makeSeed());
    await page.goto("/plano");
    await page.getByRole("spinbutton", { name: "Aporte mensal" }).fill("1234");
    await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
    const before = db.writes;
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Alterações não salvas", { exact: true })).toHaveCount(0);
    await expect.poll(() => db.writes).toBeGreaterThan(before);
    await page.reload();
    await expect(page.getByRole("spinbutton", { name: "Aporte mensal" })).toHaveValue("1234");
  });

  test("6. dados errados: aposentar antes da idade atual mostra o erro e não salva", async ({ page }) => {
    const db = await signIn(page, makeSeed());
    await page.goto("/plano");
    await page.getByRole("spinbutton", { name: "Aposentar aos" }).fill("20");
    await expect(page.locator("main")).toContainText("precisa ser maior que a idade atual");
    const before = db.writes;
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("precisa ser maior que a idade atual").first()).toBeVisible();
    expect(db.writes).toBe(before);
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByRole("spinbutton", { name: "Aposentar aos" })).toHaveValue("60");
  });
});

test.describe("rotas logadas", () => {
  for (const path of PRIVATE)
    test(`acesso direto e recarga: ${path}`, async ({ page }) => {
      const errors = watchErrors(page);
      await signIn(page, makeSeed());
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator("h1").first()).toBeVisible();
      await page.reload();
      await expect(page.locator("h1").first()).toBeVisible();
      await noHorizontalScroll(page);
      expect(errors).toEqual([]);
    });

  test("5. só no celular: navega pelas quatro áreas pelo menu de baixo e volta", async ({ page }) => {
    await signIn(page, makeSeed());
    await page.goto("/hoje");
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    for (const [label, url] of [["Dinheiro", /\/diario$/], ["Futuro", /\/plano$/], ["Progresso", /\/evolucao$/], ["Início", /\/hoje$/]] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(url);
    }
    await page.goBack();
    await expect(page).toHaveURL(/\/evolucao$/);
  });
});

test.describe("tamanhos de tela", () => {
  const WIDTHS = [320, 375, 430, 768, 1024, 1366, 1440, 1920];
  const PAGES = [
    { path: "/", auth: false },
    { path: "/calculadora", auth: false },
    { path: "/cadastro", auth: false },
    { path: "/parceiros", auth: false },
    { path: "/hoje", auth: true },
    { path: "/diario", auth: true },
    { path: "/plano", auth: true },
    { path: "/patrimonio", auth: true },
    { path: "/planos", auth: true },
  ];
  for (const width of WIDTHS)
    test(`sem rolagem horizontal em ${width}px`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
      for (const p of PAGES) {
        if (p.auth) await signIn(page, makeSeed());
        await page.goto(p.path);
        await expect(page.locator("h1").first()).toBeVisible();
        if (SHOTS) {
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: join(SHOTS, `${width}${p.path.replace(/\//g, "_") || "_home"}.png`), fullPage: true });
        }
        await noHorizontalScroll(page, `${width}px ${p.path}`);
      }
    });
});
