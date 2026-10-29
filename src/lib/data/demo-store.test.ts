import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { addMonths, monthOf, spDate } from "@/lib/gamification/rules";
import { installmentSchedule } from "@/lib/calc/installments";

const KEY = "pi_demo_state_v1";

async function freshStore() {
  vi.resetModules();
  return import("./demo-store");
}

beforeEach(() => window.localStorage.clear());

describe("exemplo da Ana", () => {
  it("tem patrimônio, meta, desafio e as duas sequências", async () => {
    const { makeSeed } = await freshStore();
    const s = makeSeed();
    expect(s.wealthEntries).toHaveLength(6);
    expect(s.goals).toHaveLength(1);
    expect(s.challenges).toHaveLength(1);
    expect(s.stats.dayStreak).toBe(14);
    expect(s.stats.weekStreak).toBeGreaterThan(0);
    expect(s.achievements.map((a) => a.code)).toEqual(expect.arrayContaining(["primeiro_registro_patrimonio", "primeira_meta"]));
    expect(s.profile.hideValues).toBe(true);
    expect(s.assets.filter((a) => a.forRetirement).reduce((t, a) => t + a.value, 0)).toBe(s.plan!.inputs.initialWealth);
  });
});

describe("evolução no modo demonstração", () => {
  it("registrar patrimônio dá XP uma vez por mês e substitui o registro do mesmo mês", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    const month = monthOf(spDate(new Date()));
    const a = demo.logWealth({ month, total: 1000 });
    expect(a.xpAwarded).toBe(30);
    expect(a.newAchievements).toContain("primeiro_registro_patrimonio");
    expect(a.dayStreak).toBe(1);
    const b = demo.logWealth({ month, total: 2000 });
    expect(b.xpAwarded).toBe(0);
    const s = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(s.wealthEntries).toHaveLength(1);
    expect(s.wealthEntries[0].total).toBe(2000);
  });

  it("não aceita mês futuro", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    expect(() => demo.logWealth({ month: addMonths(monthOf(spDate(new Date())), 1), total: 1 })).toThrow();
  });

  it("metas: XP em até 3 por mês e conclusão dá XP", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    const xps = ["a", "b", "c", "d"].map((t) => demo.createGoal({ title: t, kind: "habito" }).xpAwarded);
    expect(xps).toEqual([20, 20, 20, 0]);
    const s = JSON.parse(window.localStorage.getItem(KEY)!);
    const r = demo.completeGoal(s.goals[0].id);
    expect(r.xpAwarded).toBe(60);
    expect(r.newAchievements).toContain("meta_concluida");
    expect(demo.completeGoal(s.goals[0].id).xpAwarded).toBe(0);
  });

  it("meta de valor exige valor", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    expect(() => demo.createGoal({ title: "x", kind: "valor" })).toThrow();
  });

  it("desafio conclui sozinho ao atingir a meta e respeita o limite de andamento", async () => {
    const { demo, activeChallenges } = await freshStore();
    demo.startFresh();
    demo.startChallenge("primeira-meta-concluida");
    demo.startChallenge("revisar-orcamento");
    expect(() => demo.startChallenge("quatro-missoes")).toThrow();
    const created = demo.createGoal({ title: "x", kind: "habito" });
    expect(created.xpAwarded).toBe(20);
    const id = JSON.parse(window.localStorage.getItem(KEY)!).goals[0].id;
    const r = demo.completeGoal(id);
    expect(r.xpAwarded).toBe(60 + 40);
    expect(r.newAchievements).toContain("primeiro_desafio");
    const s = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(activeChallenges(s).map((c) => c.def.slug)).toEqual(["revisar-orcamento"]);
  });
});

describe("dados salvos pela versão 1", () => {
  it("carregam com os campos novos vazios", async () => {
    const { makeSeed } = await freshStore();
    const v1 = makeSeed() as unknown as Record<string, unknown>;
    for (const k of ["wealthEntries", "goals", "challenges", "days", "assets", "assetValuations", "accounts", "categories", "transactions", "recurring", "categoryRules", "budget", "holdings", "trades", "allocationTargets"]) delete v1[k];
    for (const k of ["objective", "reviewCadence", "missingFields"]) delete (v1["profile"] as Record<string, unknown>)[k];
    v1["version"] = 1;
    v1["xpEvents"] = (v1["xpEvents"] as { action: string }[]).filter((e) => !["wealth_logged", "goal_created"].includes(e.action));
    v1["stats"] = { totalXp: 500, level: 2, weekStreak: 3, bestWeekStreak: 4 };
    delete (v1["profile"] as Record<string, unknown>)["hideValues"];
    window.localStorage.setItem(KEY, JSON.stringify(v1));

    const { demo } = await freshStore();
    const r = demo.logWealth({ month: monthOf(spDate(new Date())), total: 100 });
    expect(r.xpAwarded).toBe(30);
    const s = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(s.version).toBe(8);
    expect(s.holdings).toEqual([]);
    expect(s.budget).toEqual({ assigned: {}, templates: [] });
    expect(s.transactions).toEqual([]);
    expect(s.categories.length).toBeGreaterThan(0);
    expect(s.journey).toEqual({ testedOutUnits: [], dailyMissions: [] });
    expect(s.assets).toEqual([]);
    expect(s.assetValuations).toEqual([]);
    expect(s.profile.missingFields).toEqual([]);
    expect(s.profile.reviewCadence).toBe("trimestral");
    expect(s.goals).toEqual([]);
    expect(s.profile.hideValues).toBe(true);
    expect(s.stats.bestWeekStreak).toBeGreaterThanOrEqual(4);
  });
});

describe("registro do mês e patrimônio item a item", () => {
  it("registrar 'não aportei' dá o mesmo XP que registrar um aporte, uma vez por mês", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    const month = monthOf(spDate(new Date()));
    expect(demo.logContribution({ month, made: false }).xpAwarded).toBe(20);
    expect(demo.logContribution({ month, made: true, amount: 5000 }).xpAwarded).toBe(0);
    const prev = addMonths(month, -1);
    expect(demo.logContribution({ month: prev, made: true, amount: 100 }).xpAwarded).toBe(20);
  });

  it("cria, edita e remove itens sem XP e rejeita valor negativo", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    demo.saveAsset({ name: "PGBL", category: "pgbl", value: 1000, forRetirement: true });
    let s = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(s.assets).toHaveLength(1);
    expect(s.stats.totalXp).toBe(0);
    demo.saveAsset({ ...s.assets[0], value: 1500 });
    s = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(s.assets).toHaveLength(1);
    expect(s.assets[0].value).toBe(1500);
    expect(() => demo.saveAsset({ name: "x", category: "outro", value: -1, forRetirement: false })).toThrow();
    demo.deleteAsset(s.assets[0].id);
    expect(JSON.parse(window.localStorage.getItem(KEY)!).assets).toEqual([]);
  });
});

describe("histórico do patrimônio", () => {
  it("guarda o valor do item no mês, sem duplicar, e apaga o histórico junto com o item", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    const month = monthOf(spDate(new Date()));
    demo.saveAsset({ name: "PGBL", category: "pgbl", value: 1000, forRetirement: true });
    let s = JSON.parse(window.localStorage.getItem(KEY)!);
    const id = s.assets[0].id;
    demo.saveAsset({ ...s.assets[0], name: "PGBL do banco" }); // mesmo valor: não entra no histórico
    demo.saveAsset({ ...s.assets[0], value: 1500 });
    s = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(s.assetValuations).toEqual([expect.objectContaining({ assetId: id, month, value: 1500 })]);
    demo.deleteAsset(id);
    expect(JSON.parse(window.localStorage.getItem(KEY)!).assetValuations).toEqual([]);
  });

  it("registra o mês com os itens do Patrimônio, com o detalhamento e o XP do registro", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    expect(() => demo.logWealthFromAssets()).toThrow();
    demo.saveAsset({ name: "PGBL", category: "pgbl", value: 8000, forRetirement: true });
    demo.saveAsset({ name: "Tesouro", category: "investimentos", value: 2000, forRetirement: true });
    demo.saveAsset({ name: "Reserva", category: "reserva", value: 6000, forRetirement: false });
    demo.saveAsset({ name: "Cartão", category: "divida", value: 900, forRetirement: true });
    const r = demo.logWealthFromAssets();
    expect(r.xpAwarded).toBe(30);
    const s = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(s.wealthEntries).toHaveLength(1);
    expect(s.wealthEntries[0]).toMatchObject({ month: monthOf(spDate(new Date())), total: 10000, previdencia: 8000 });
    expect(s.wealthEntries[0].breakdown.map((b: { name: string }) => b.name)).toEqual(["PGBL", "Tesouro"]);
    // Um registro manual depois substitui o do mês e não carrega o detalhamento antigo.
    demo.logWealth({ month: s.wealthEntries[0].month, total: 9000 });
    expect(JSON.parse(window.localStorage.getItem(KEY)!).wealthEntries[0].breakdown).toBeNull();
  });

  it("no exemplo da Ana, o histórico dos itens bate com os registros mensais", async () => {
    const { makeSeed } = await freshStore();
    const { assetHistory } = await import("@/lib/calc/networth");
    const s = makeSeed();
    const retirement = s.assets.filter((a) => a.forRetirement);
    for (const w of s.wealthEntries) {
      const sum = retirement.reduce((t, a) => t + (assetHistory(s.assetValuations, a.id).find((p) => p.month === w.month)?.value ?? 0), 0);
      expect(sum).toBe(w.total);
    }
  });
});

describe("jornada", () => {
  afterEach(() => vi.useRealTimers());

  it("progresso livre: duas lições no mesmo dia dão XP cada; lição bloqueada não abre", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T15:00:00Z")); // quarta: missão é revisar meta
    const { demo } = await freshStore();
    demo.startFresh();
    expect(demo.completeLesson(1).xpAwarded).toBe(10);
    expect(demo.completeLesson(2).xpAwarded).toBe(10);
    expect(() => demo.completeLesson(9)).toThrow();
    expect(demo.completeLesson(1).xpAwarded).toBe(0);
  });

  it("missão do dia: lição na segunda conta uma vez; missão de outro tipo é recusada", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T15:00:00Z")); // segunda: aprender
    const { demo } = await freshStore();
    demo.startFresh();
    expect(demo.completeLesson(1).xpAwarded).toBe(10 + 10);
    expect(demo.completeLesson(2).xpAwarded).toBe(10);
    expect(() => demo.completeDailyMission("goal")).toThrow();
  });

  it("missão de meta na quarta, uma vez por dia", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T15:00:00Z"));
    const { demo } = await freshStore();
    demo.startFresh();
    expect(demo.completeDailyMission("goal").xpAwarded).toBe(10);
    expect(demo.completeDailyMission("goal").xpAwarded).toBe(0);
  });

  it("revisão de terça só conta acertando 2 de 3 perguntas de lições concluídas", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T15:00:00Z")); // lições na segunda
    const { demo } = await freshStore();
    const { reviewQuestions } = await import("@/lib/journey/journey");
    demo.startFresh();
    demo.completeLesson(1);
    demo.completeLesson(2);
    vi.setSystemTime(new Date("2026-10-20T15:00:00Z")); // terça: quiz
    const qs = reviewQuestions([1, 2], "2026-10-20");
    const wrong = Object.fromEntries(qs.map((q) => [q.key, "zzz"]));
    expect(() => demo.completeDailyMission("quiz", wrong)).toThrow();
    const right = Object.fromEntries(qs.map((q) => [q.key, q.question.correct]));
    expect(demo.completeDailyMission("quiz", right).xpAwarded).toBe(10);
  });

  it("teste de nivelamento libera a unidade sem XP e sem concluir as lições", async () => {
    const { demo } = await freshStore();
    const { placementQuestions } = await import("@/lib/journey/journey");
    demo.startFresh();
    const wrong = demo.submitPlacement(1, {});
    expect(wrong.passed).toBe(false);
    const right = Object.fromEntries(placementQuestions(1).map((q) => [q.key, q.question.correct]));
    const r = demo.submitPlacement(1, right);
    expect(r).toMatchObject({ passed: true, xpAwarded: 0 });
    const s = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(s.journey.testedOutUnits).toEqual([1]);
    expect(s.lessonCompletions).toEqual({});
    expect(demo.completeLesson(6).xpAwarded).toBeGreaterThanOrEqual(10);
    expect(() => demo.submitPlacement(1, right)).toThrow();
  });

  it("nível vem do XP total", async () => {
    const { makeSeed } = await freshStore();
    const { levelFromXp } = await import("@/lib/gamification/rules");
    const s = makeSeed();
    expect(s.stats.level).toBe(levelFromXp(s.stats.totalXp).level);
    expect(s.achievements.map((a) => a.code)).toContain("diagnostico_inicial");
  });
});

describe("livro-caixa", () => {
  const state = () => JSON.parse(window.localStorage.getItem(KEY)!);
  const today = () => spDate(new Date());

  async function withAccounts() {
    const { demo } = await freshStore();
    demo.startFresh();
    demo.saveAccount({ name: "Conta corrente", kind: "corrente", openingBalance: 100000 });
    demo.saveAccount({ name: "PGBL", kind: "previdencia", openingBalance: 0 });
    const [cc, prev] = state().accounts.map((a: { id: string }) => a.id);
    return { demo, cc, prev };
  }

  it("o exemplo da Ana tem contas, recorrências lançadas e a transferência ligada ao aporte do mês passado", async () => {
    const { makeSeed } = await freshStore();
    const s = makeSeed();
    expect(s.accounts).toHaveLength(3);
    expect(s.transactions.some((t) => t.source === "recorrente")).toBe(true);
    const out = s.transactions.find((t) => t.contributionId);
    expect(out).toBeDefined();
    expect(s.contributions.find((c) => c.id === out!.contributionId)?.amount).toBe(-out!.amount / 100);
    expect(s.transactions.every((t) => t.date <= spDate(new Date()))).toBe(true);
  });

  it("lança com a categoria das regras e lembra a categoria escolhida", async () => {
    const { demo, cc } = await withAccounts();
    demo.saveCategoryRule({ op: "contem", value: "uber", categoryId: "cat-transporte", renameTo: "Uber" });
    demo.addTransaction({ accountId: cc, date: today(), amount: -2390, payee: "UBER *TRIP" });
    expect(state().transactions[0]).toMatchObject({ payee: "Uber", categoryId: "cat-transporte", source: "manual" });
    demo.addTransaction({ accountId: cc, date: today(), amount: -1500, payee: "Padaria", categoryId: "cat-mercado", remember: true });
    demo.addTransaction({ accountId: cc, date: today(), amount: -900, payee: "padaria" });
    expect(state().transactions[2].categoryId).toBe("cat-mercado");
    expect(() => demo.addTransaction({ accountId: cc, date: today(), amount: 0, payee: "x" })).toThrow();
    expect(() => demo.addTransaction({ accountId: "nada", date: today(), amount: 1, payee: "x" })).toThrow();
  });

  it("transferência cria duas pernas sem categoria, edita e exclui as duas juntas", async () => {
    const { demo, cc, prev } = await withAccounts();
    demo.addTransfer({ fromId: cc, toId: prev, date: today(), amount: 50000 });
    let txs = state().transactions;
    expect(txs).toHaveLength(2);
    expect(txs.map((t: { amount: number }) => t.amount).sort()).toEqual([-50000, 50000]);
    expect(txs[0].transferId).toBe(txs[1].id);
    demo.updateTransaction(txs[0].id, { amount: -60000, categoryId: "cat-outros" });
    txs = state().transactions;
    expect(txs.find((t: { accountId: string }) => t.accountId === prev).amount).toBe(60000);
    expect(txs.every((t: { categoryId: string | null }) => t.categoryId === null)).toBe(true);
    demo.deleteTransaction(txs[1].id);
    expect(state().transactions).toEqual([]);
  });

  it("transferência para a previdência pode registrar o aporte do mês, com XP", async () => {
    const { demo, cc, prev } = await withAccounts();
    expect(() => demo.addTransfer({ fromId: prev, toId: cc, date: today(), amount: 100, contribution: "previdencia" })).toThrow();
    const r = demo.addTransfer({ fromId: cc, toId: prev, date: today(), amount: 100000, contribution: "previdencia" });
    expect(r.xpAwarded).toBe(20);
    const s = state();
    expect(s.contributions).toEqual([expect.objectContaining({ made: true, amount: 1000, destination: "previdencia", month: monthOf(today()) })]);
    expect(s.transactions.find((t: { amount: number }) => t.amount < 0).contributionId).toBe(s.contributions[0].id);
  });

  it("recorrência lança as ocorrências vencidas uma vez só", async () => {
    const { demo, cc } = await withAccounts();
    const start = addMonths(monthOf(today()), -2);
    demo.saveRecurring({ accountId: cc, amount: -200000, payee: "Aluguel", categoryId: "cat-moradia", note: null, startDate: start, frequency: "mensal", interval: 1, endDate: null, weekend: "manter" });
    expect(state().transactions).toHaveLength(3);
    expect(demo.runRecurring()).toBe(0);
    expect(state().transactions).toHaveLength(3);
    const ruleId = state().recurring[0].id;
    demo.deleteRecurring(ruleId);
    expect(state().transactions).toHaveLength(3);
  });

  it("importa extrato, vincula ao lançamento manual e não duplica ao importar de novo", async () => {
    const { demo, cc } = await withAccounts();
    const d = today();
    demo.addTransaction({ accountId: cc, date: d, amount: -45090, payee: "Mercado", categoryId: "cat-mercado" });
    const rows = [
      { importedId: "F1", date: d, amount: -45090, payee: "COMPRA PAO DE ACUCAR", memo: null },
      { importedId: "F2", date: d, amount: 800000, payee: "PIX RECEBIDO", memo: "NF 1" },
    ];
    expect(demo.importTransactions(cc, rows)).toMatchObject({ added: 1, matched: 1, duplicates: 0 });
    const s = state();
    expect(s.transactions).toHaveLength(2);
    expect(s.transactions[0]).toMatchObject({ payee: "Mercado", categoryId: "cat-mercado", importedId: "F1" });
    expect(s.transactions[1]).toMatchObject({ source: "importado", importedId: "F2", note: "NF 1" });
    expect(demo.importTransactions(cc, rows)).toMatchObject({ added: 0, matched: 0, duplicates: 2 });
  });

  it("excluir conta leva os lançamentos e a outra perna das transferências", async () => {
    const { demo, cc, prev } = await withAccounts();
    demo.addTransfer({ fromId: cc, toId: prev, date: today(), amount: 100 });
    demo.addTransaction({ accountId: cc, date: today(), amount: -100, payee: "x" });
    demo.deleteAccount(prev);
    const s = state();
    expect(s.accounts).toHaveLength(1);
    expect(s.transactions).toHaveLength(1);
  });

  it("excluir categoria deixa os lançamentos sem categoria e remove as regras dela", async () => {
    const { demo, cc } = await withAccounts();
    demo.saveCategory({ name: "Pets", kind: "despesa" });
    const pets = state().categories.find((c: { name: string }) => c.name === "Pets").id;
    expect(() => demo.saveCategory({ name: "pets", kind: "despesa" })).toThrow();
    demo.addTransaction({ accountId: cc, date: today(), amount: -100, payee: "Ração", categoryId: pets, remember: true });
    demo.deleteCategory(pets);
    const s = state();
    expect(s.transactions[0].categoryId).toBeNull();
    expect(s.categoryRules).toEqual([]);
  });
});

describe("orçamento por envelopes", () => {
  const state = () => JSON.parse(window.localStorage.getItem(KEY)!);
  const month = () => monthOf(spDate(new Date()));

  it("no exemplo da Ana, o aporte do mês passado zerou o envelope Aposentadoria e o deste mês ainda está para sair", async () => {
    const { makeSeed, budgetMonths } = await freshStore();
    const s = makeSeed();
    const months = budgetMonths(s, month());
    const prev = months.at(-2)!;
    const cur = months.at(-1)!;
    expect(prev.envelopes["env-aposentadoria"]).toMatchObject({ assigned: 100000, activity: -100000, balance: 0 });
    expect(cur.envelopes["env-aposentadoria"]).toMatchObject({ assigned: 100000, activity: 0, balance: 100000 });
    expect(cur.envelopes["cat-moradia"]!.activity).toBe(-200000);
  });

  it("distribuir, mover entre envelopes e aplicar os modelos", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    const m = month();
    demo.setAssigned(m, "cat-mercado", 50000);
    demo.moveBudget(m, "cat-mercado", "cat-lazer", 10000);
    expect(state().budget.assigned[m]).toEqual({ "cat-mercado": 40000, "cat-lazer": 10000 });
    demo.setAssigned(m, "cat-lazer", 0);
    expect(state().budget.assigned[m]).toEqual({ "cat-mercado": 40000 });
    expect(() => demo.setAssigned(addMonths(m, 3), "cat-lazer", 100)).toThrow();

    demo.saveTemplate({ envelopeId: "cat-moradia", kind: "fixo", amount: 200000, target: null, deadline: null, percent: null });
    demo.saveTemplate({ envelopeId: "cat-educacao", kind: "ate_data", amount: null, target: 300000, deadline: addMonths(m, 2), percent: null });
    expect(() => demo.saveTemplate({ envelopeId: "cat-lazer", kind: "percentual", amount: null, target: null, deadline: null, percent: 0 })).toThrow();
    expect(() => demo.saveTemplate({ envelopeId: "nao-existe", kind: "fixo", amount: 1, target: null, deadline: null, percent: null })).toThrow();
    expect(demo.applyTemplates(m).total).toBe(200000 + 100000);
    expect(state().budget.assigned[m]).toMatchObject({ "cat-moradia": 200000, "cat-educacao": 100000, "cat-mercado": 40000 });
  });

  it("excluir a categoria tira o envelope do orçamento", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    demo.saveCategory({ name: "Pets", kind: "despesa" });
    const pets = state().categories.find((c: { name: string }) => c.name === "Pets").id;
    demo.setAssigned(month(), pets, 1000);
    demo.saveTemplate({ envelopeId: pets, kind: "fixo", amount: 1000, target: null, deadline: null, percent: null });
    demo.deleteCategory(pets);
    expect(state().budget).toEqual({ assigned: { [month()]: {} }, templates: [] });
  });
});

describe("investimentos", () => {
  const state = () => JSON.parse(window.localStorage.getItem(KEY)!);
  const today = () => spDate(new Date());

  async function withAsset(category: "investimentos" | "reserva" = "investimentos") {
    const { demo } = await freshStore();
    demo.startFresh();
    demo.saveAsset({ name: "Corretora", category, value: 5000, forRetirement: true });
    return { demo, assetId: state().assets[0].id as string };
  }

  it("no exemplo da Ana, as posições do Tesouro somam o mesmo valor do item", async () => {
    const { makeSeed, holdingsValue } = await freshStore();
    const s = makeSeed();
    const tesouro = s.assets.find((a) => a.name.startsWith("Tesouro"))!;
    expect(holdingsValue(s, tesouro.id)).toBe(tesouro.value * 100);
  });

  it("posição sem operação não mexe no valor do item; depois da compra, o item vale o que as posições valem", async () => {
    const { demo, assetId } = await withAsset();
    demo.saveHolding({ assetId, name: "BOVA11", assetClass: "acoes", price: 12000 });
    expect(state().assets[0].value).toBe(5000);
    const holdingId = state().holdings[0].id;
    demo.addTrade({ holdingId, date: today(), type: "compra", quantity: 10, unitPrice: 11000, fees: 500 });
    expect(state().assets[0].value).toBe(1200);
    // Com posições, editar o item não muda o valor; mudar o preço, sim.
    demo.saveAsset({ ...state().assets[0], value: 99999 });
    expect(state().assets[0].value).toBe(1200);
    demo.saveHolding({ id: holdingId, assetId, name: "BOVA11", assetClass: "acoes", price: 13000 });
    expect(state().assets[0].value).toBe(1300);
    expect(state().assetValuations.at(-1)).toMatchObject({ assetId, value: 1300 });
  });

  it("recusa venda acima da quantidade, data futura e posição em item que não é investimento", async () => {
    const { demo, assetId } = await withAsset();
    demo.saveHolding({ assetId, name: "IVVB11", assetClass: "exterior", price: 30000 });
    const holdingId = state().holdings[0].id;
    demo.addTrade({ holdingId, date: today(), type: "compra", quantity: 2, unitPrice: 30000 });
    expect(() => demo.addTrade({ holdingId, date: today(), type: "venda", quantity: 3, unitPrice: 30000 })).toThrow();
    expect(() => demo.addTrade({ holdingId, date: "2999-01-01", type: "compra", quantity: 1, unitPrice: 1 })).toThrow();
    expect(() => demo.saveAsset({ ...state().assets[0], category: "imovel" })).toThrow();
    const reserva = await withAsset("reserva");
    expect(() => reserva.demo.saveHolding({ assetId: reserva.assetId, name: "CDB", assetClass: "renda_fixa", price: 100 })).toThrow();
  });

  it("não deixa excluir a compra que sustenta uma venda; excluir o item leva posições e operações", async () => {
    const { demo, assetId } = await withAsset();
    demo.saveHolding({ assetId, name: "HGLG11", assetClass: "fiis", price: 16000 });
    const holdingId = state().holdings[0].id;
    demo.addTrade({ holdingId, date: today(), type: "compra", quantity: 2, unitPrice: 15000 });
    demo.addTrade({ holdingId, date: today(), type: "venda", quantity: 1, unitPrice: 16000 });
    const buy = state().trades.find((t: { type: string }) => t.type === "compra").id;
    expect(() => demo.deleteTrade(buy)).toThrow();
    demo.deleteAsset(assetId);
    expect(state().holdings).toEqual([]);
    expect(state().trades).toEqual([]);
  });

  it("metas de alocação precisam somar 100%", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    expect(() => demo.setAllocationTargets({ previdencia: 70, acoes: 20 })).toThrow();
    demo.setAllocationTargets({ previdencia: 70, acoes: 30, renda_fixa: 0 });
    expect(state().allocationTargets).toEqual({ previdencia: 70, acoes: 30 });
    demo.setAllocationTargets({});
    expect(state().allocationTargets).toEqual({});
  });
});

describe("XP e conquistas das novas funções", () => {
  const today = () => spDate(new Date());
  const month = () => monthOf(today());

  it("importar extrato: XP uma vez por mês, só quando entra algo novo, e a conquista", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    demo.saveAccount({ name: "Conta", kind: "corrente", openingBalance: 0 });
    const cc = JSON.parse(window.localStorage.getItem(KEY)!).accounts[0].id;
    const row = (id: string) => ({ importedId: id, date: today(), amount: -100, payee: "x", memo: null });
    const a = demo.importTransactions(cc, [row("A")]);
    expect(a.xpAwarded).toBe(20);
    expect(a.newAchievements).toContain("primeiro_extrato");
    expect(demo.importTransactions(cc, [row("B")]).xpAwarded).toBe(0);
  });

  it("planejar o mês dá XP uma vez por mês planejado; mês passado e mover dinheiro não dão", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    const r = demo.setAssigned(month(), "cat-mercado", 10000);
    expect(r.xpAwarded).toBe(20);
    expect(r.newAchievements).toContain("primeiro_orcamento");
    expect(demo.setAssigned(month(), "cat-lazer", 10000).xpAwarded).toBe(0);
    expect(demo.setAssigned(addMonths(month(), 1), "cat-lazer", 10000).xpAwarded).toBe(20);
    expect(demo.setAssigned(addMonths(month(), -1), "cat-lazer", 10000).xpAwarded).toBe(0);
    expect(demo.moveBudget(addMonths(month(), 2), "cat-lazer", "cat-mercado", 100).xpAwarded).toBe(0);
  });

  it("operação de investimento e metas de alocação", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    demo.saveAsset({ name: "Corretora", category: "investimentos", value: 0, forRetirement: true });
    const s0 = JSON.parse(window.localStorage.getItem(KEY)!);
    demo.saveHolding({ assetId: s0.assets[0].id, name: "BOVA11", assetClass: "acoes", price: 100 });
    const holdingId = JSON.parse(window.localStorage.getItem(KEY)!).holdings[0].id;
    const t = demo.addTrade({ holdingId, date: today(), type: "compra", quantity: 1, unitPrice: 100 });
    expect(t.xpAwarded).toBe(20);
    expect(t.newAchievements).toContain("primeiro_investimento");
    expect(demo.addTrade({ holdingId, date: today(), type: "compra", quantity: 1, unitPrice: 100 }).xpAwarded).toBe(0);
    const g = demo.setAllocationTargets({ acoes: 100 });
    expect(g.xpAwarded).toBe(0);
    expect(g.newAchievements).toContain("carteira_com_metas");
  });
});

describe("fechamento do mês", () => {
  const month = () => monthOf(spDate(new Date()));

  it("no exemplo da Ana, só falta o aporte; com ele, fecha o mês com XP uma vez e a conquista", async () => {
    const { demo, monthCloseSteps, makeSeed } = await freshStore();
    const seed = makeSeed();
    const before = monthCloseSteps(seed);
    expect(before.steps.filter((x) => !x.done).map((x) => x.key)).toEqual(["aporte"]);
    expect(() => demo.closeMonth()).toThrow();
    demo.logContribution({ month: month(), made: true, amount: 1000, destination: "previdencia" });
    const r = demo.closeMonth();
    expect(r.xpAwarded).toBe(50);
    expect(r.newAchievements).toContain("primeiro_fechamento");
    expect(demo.closeMonth().xpAwarded).toBe(0);
  });

  it("conta nova sem contas começa em 0 de 2: os passos do livro-caixa não se aplicam", async () => {
    const { demo, monthCloseSteps } = await freshStore();
    demo.startFresh();
    const s0 = JSON.parse(window.localStorage.getItem(KEY)!);
    const c0 = monthCloseSteps(s0);
    expect(c0.steps.map((x) => [x.key, x.done])).toEqual([
      ["aporte", false],
      ["patrimonio", false],
    ]);
    expect(c0.doneCount).toBe(0);
  });

  it("no modo Simples, um limite de gasto conclui o passo do orçamento e o mês pode fechar", async () => {
    const { demo, monthCloseSteps } = await freshStore();
    demo.startFresh();
    demo.saveAccount({ name: "Conta", kind: "corrente", openingBalance: 0 });
    const cc = JSON.parse(window.localStorage.getItem(KEY)!).accounts[0].id;
    demo.addTransaction({ accountId: cc, date: spDate(new Date()), amount: -100, payee: "Mercado", categoryId: "cat-mercado" });
    const step = () => monthCloseSteps(JSON.parse(window.localStorage.getItem(KEY)!)).steps.find((x) => x.key === "orcamento")!;
    expect(step().done).toBe(false);
    demo.saveLimit({ categoryId: null, period: "mes", amount: 200000 });
    expect(step().done).toBe(true);
    demo.logContribution({ month: month(), made: true, amount: 500, destination: "previdencia" });
    demo.logWealth({ month: month(), total: 1000 });
    expect(() => demo.closeMonth()).not.toThrow();
  });

  it("com conta, lançamento sem categoria trava o passo 2", async () => {
    const { demo, monthCloseSteps } = await freshStore();
    demo.startFresh();
    demo.saveAccount({ name: "Conta", kind: "corrente", openingBalance: 0 });
    const cc = JSON.parse(window.localStorage.getItem(KEY)!).accounts[0].id;
    demo.addTransaction({ accountId: cc, date: spDate(new Date()), amount: -100, payee: "Sem regra" });
    const s1 = JSON.parse(window.localStorage.getItem(KEY)!);
    const c = monthCloseSteps(s1);
    expect(c.steps.slice(0, 2).map((x) => x.done)).toEqual([true, false]);
    expect(c.uncategorized).toHaveLength(1);
  });
});

describe("parcelas e desfazer", () => {
  const state = () => JSON.parse(window.localStorage.getItem(KEY)!);
  const today = () => spDate(new Date());

  async function withAccount() {
    const { demo, ruleAmount } = await freshStore();
    demo.startFresh();
    demo.saveAccount({ name: "Cartão", kind: "cartao", openingBalance: 0 });
    const cc = state().accounts[0].id as string;
    return { demo, ruleAmount, cc };
  }

  it("compra parcelada vira recorrência com fim; a primeira parcela leva os centavos e já entra", async () => {
    const { demo, ruleAmount, cc } = await withAccount();
    const rule = demo.addInstallmentPurchase({ accountId: cc, firstDate: today(), total: 100000, count: 3, payee: "TV", categoryId: "cat-outros" });
    const s = state();
    expect(s.recurring).toHaveLength(1);
    expect(s.transactions).toHaveLength(1);
    expect(s.transactions[0]).toMatchObject({ amount: -33334, recurringId: rule.id, source: "recorrente" });
    expect(ruleAmount(rule, installmentSchedule(100000, 3, today())[1]!.occurrenceDate)).toBe(-33333);
    expect(() => demo.addInstallmentPurchase({ accountId: cc, firstDate: today(), total: 100000, count: 61, payee: "TV" })).toThrow();
  });

  it("desfazer remove o lançamento novo, volta a versão antes da edição e traz de volta o excluído", async () => {
    const { demo, cc } = await withAccount();
    const t = demo.addTransaction({ accountId: cc, date: today(), amount: -6200, payee: "Farmácia" });
    expect(demo.undoLast()).toBe("Lançamento");
    expect(state().transactions).toHaveLength(0);
    expect(() => demo.undoLast()).toThrow();

    const u = demo.addTransaction({ accountId: cc, date: today(), amount: -5400, payee: "Almoço" });
    demo.updateTransaction(u.id, { amount: -4500 });
    demo.undoLast();
    expect(state().transactions[0]).toMatchObject({ id: u.id, amount: -5400 });

    demo.deleteTransaction(u.id);
    expect(state().transactions).toHaveLength(0);
    demo.undoLast();
    expect(state().transactions[0]).toMatchObject({ id: u.id, amount: -5400 });
    expect(t.id).not.toBe(u.id);
  });

  it("desfazer a compra parcelada apaga a regra e as parcelas lançadas", async () => {
    const { demo, cc } = await withAccount();
    demo.addInstallmentPurchase({ accountId: cc, firstDate: today(), total: 30000, count: 3, payee: "Cadeira" });
    demo.undoLast();
    expect(state().recurring).toHaveLength(0);
    expect(state().transactions).toHaveLength(0);
  });

  it("aviso ignorado fica guardado", async () => {
    const { demo } = await withAccount();
    demo.dismissAlert("duplicado:a:b");
    demo.dismissAlert("duplicado:a:b");
    expect(state().dismissedAlerts).toEqual(["duplicado:a:b"]);
  });
});

describe("ocorrência excluída", () => {
  const state = () => JSON.parse(window.localStorage.getItem(KEY)!);
  const today = () => spDate(new Date());

  it("parcela excluída não volta quando as recorrências rodam de novo; Desfazer traz de volta", async () => {
    const { demo } = await freshStore();
    demo.startFresh();
    demo.saveAccount({ name: "Cartão", kind: "cartao", openingBalance: 0 });
    const cc = state().accounts[0].id as string;
    const rule = demo.addInstallmentPurchase({ accountId: cc, firstDate: today(), total: 30000, count: 3, payee: "Cadeira" });
    const first = state().transactions[0];
    demo.deleteTransaction(first.id);
    expect(demo.runRecurring()).toBe(0);
    expect(state().transactions).toHaveLength(0);
    expect(state().recurring[0].skipped).toEqual([first.occurrenceDate]);
    demo.undoLast();
    expect(state().transactions).toHaveLength(1);
    expect(state().recurring[0].skipped).toEqual([]);
    expect(demo.runRecurring()).toBe(0);
    expect(rule.id).toBe(first.recurringId);
  });
});

describe("limites de gasto", () => {
  const state = () => JSON.parse(window.localStorage.getItem(KEY)!);

  it("salva o limite e avisa a partir de 75% do período", async () => {
    const { demo } = await freshStore();
    const { dailyAlerts } = await import("./selectors");
    demo.startFresh();
    demo.saveAccount({ name: "Conta", kind: "corrente", openingBalance: 100000 });
    const cc = state().accounts[0].id as string;
    demo.saveLimit({ categoryId: "cat-restaurantes", period: "semana", amount: 30000 });
    demo.addTransaction({ accountId: cc, date: spDate(new Date()), amount: -25000, payee: "Restaurante", categoryId: "cat-restaurantes" });
    const s = state();
    const alert = dailyAlerts(s).find((a) => a.kind === "limite");
    expect(alert).toMatchObject({ kind: "limite", level: "atencao", spent: 25000, limit: 30000 });
    expect(() => demo.saveLimit({ categoryId: null, period: "dia", amount: 0 })).toThrow();
    demo.deleteLimit(s.limits[0].id);
    expect(state().limits).toEqual([]);
  });
});

describe("dívidas: quitar ou investir", () => {
  const state = () => JSON.parse(window.localStorage.getItem(KEY)!);
  it("guarda juros e parcela só em dívidas e compara com o plano", async () => {
    const { demo } = await freshStore();
    const { debtsView, xrayView } = await import("./selectors");
    demo.saveAsset({ name: "Cartão rotativo", category: "divida", value: 10000, forRetirement: false, rateMonthly: 0.03, payment: 500 });
    demo.saveAsset({ name: "PGBL extra", category: "pgbl", value: 100, forRetirement: true, rateMonthly: 0.03 });
    const s = state();
    expect(s.assets.find((a: { name: string }) => a.name === "PGBL extra").rateMonthly).toBeNull();
    const d = debtsView(s).find((x) => x.asset.name === "Cartão rotativo")!;
    expect(d.comparison?.verdict).toBe("quitar");
    expect(d.months).toBeGreaterThan(20);
    expect(xrayView(s).issues.some((i) => i.code === "divida_sem_juros")).toBe(false);
    expect(() => demo.saveAsset({ name: "x", category: "divida", value: 1, forRetirement: false, rateMonthly: 0.5 })).toThrow();
  });
});

describe("cache de leitura", () => {
  it("nunca guarda o resultado de um rascunho (estado que ainda não foi gravado)", async () => {
    const { memoOnState, makeSeed } = await freshStore();
    const draft = makeSeed();
    let runs = 0;
    const read = () => memoOnState(draft, "k", () => ++runs);
    expect(read()).toBe(1);
    expect(read()).toBe(2);
  });

  it("recalcula só quando muda uma parte que o cálculo leu", async () => {
    const { demo, memoOnState, useDemo } = await freshStore();
    demo.reset();
    const { result } = renderHook(() => useDemo());
    let runs = 0;
    // Lê o perfil: refaz quando o perfil muda.
    const readProfile = () => memoOnState(result.current, "perfil", (st) => (runs++, st.profile.displayName));
    expect(readProfile()).toBe("Ana");
    expect(readProfile()).toBe("Ana");
    expect(runs).toBe(1);
    act(() => demo.updateProfile({ displayName: "Bia" }));
    expect(readProfile()).toBe("Bia");
    expect(runs).toBe(2);
    // Lê só as contas: mudar o perfil não refaz.
    let accRuns = 0;
    const readAccounts = () => memoOnState(result.current, "contas", (st) => (accRuns++, st.accounts.length));
    readAccounts();
    act(() => demo.updateProfile({ displayName: "Caio" }));
    readAccounts();
    expect(accRuns).toBe(1);
  });

  it("um cálculo em cache dentro de outro passa as leituras adiante", async () => {
    const { demo, memoOnState, useDemo } = await freshStore();
    demo.reset();
    const { result } = renderHook(() => useDemo());
    const inner = (st: typeof result.current) => memoOnState(st, "dentro", (x) => x.profile.displayName);
    let outerRuns = 0;
    const outer = () => memoOnState(result.current, "fora", (st) => (outerRuns++, inner(st)));
    inner(result.current); // o de dentro já está em cache antes do de fora
    expect(outer()).toBe("Ana");
    act(() => demo.updateProfile({ displayName: "Bia" }));
    expect(outer()).toBe("Bia"); // o de fora sabe que depende do perfil, mesmo pegando o de dentro do cache
    expect(outerRuns).toBe(2);
  });

  it("seletores reais: lançar um gasto refaz o mês; mudar o perfil não", async () => {
    const store = await freshStore();
    const { ledgerMonth } = await import("./selectors");
    store.demo.reset();
    const { result } = renderHook(() => store.useDemo());
    const month = monthOf(spDate(new Date()));
    const first = ledgerMonth(result.current, month);
    act(() => store.demo.updateProfile({ displayName: "Bia" }));
    expect(ledgerMonth(result.current, month)).toBe(first);
    act(() => {
      store.demo.addTransaction({ accountId: result.current.accounts[0]!.id, date: spDate(new Date()), amount: -500, payee: "Café", categoryId: null });
    });
    const after = ledgerMonth(result.current, month);
    expect(after).not.toBe(first);
    expect(after).toEqual(ledgerMonth(structuredClone(result.current), month)); // igual a calcular do zero
  });
});

describe("ações compartilham o que não mudaram", () => {
  it("mudar o perfil não troca lançamentos, contas nem orçamento", async () => {
    const { demo, useDemo } = await freshStore();
    demo.reset();
    const { result } = renderHook(() => useDemo());
    const before = result.current;
    act(() => demo.updateProfile({ displayName: "Bia" }));
    const after = result.current;
    expect(after).not.toBe(before);
    expect(after.profile).not.toBe(before.profile);
    expect(after.transactions).toBe(before.transactions);
    expect(after.accounts).toBe(before.accounts);
    expect(after.budget).toBe(before.budget);
    expect(after.assets).toBe(before.assets);
  });

  it("um lançamento novo só troca a lista de lançamentos; os itens antigos continuam os mesmos", async () => {
    const { demo, useDemo } = await freshStore();
    demo.reset();
    const { result } = renderHook(() => useDemo());
    const before = result.current;
    const account = before.accounts[0]!;
    act(() => {
      demo.addTransaction({ accountId: account.id, date: spDate(new Date()), amount: -1234, payee: "Padaria", categoryId: null });
    });
    const after = result.current;
    expect(after.transactions).not.toBe(before.transactions);
    expect(after.transactions.length).toBe(before.transactions.length + 1);
    for (const t of before.transactions) expect(after.transactions.find((x) => x.id === t.id)).toBe(t);
    expect(after.categories).toBe(before.categories);
    expect(after.profile).toBe(before.profile);
  });

  it("ação que falha no meio não deixa nada no estado vivo", async () => {
    const { demo, useDemo } = await freshStore();
    demo.reset();
    const { result } = renderHook(() => useDemo());
    const before = result.current;
    // Meta inválida: a categoria entra na cópia antes da validação, que lança erro.
    expect(() => demo.saveReserveEnvelope(0, "2027-01-01")).toThrow();
    expect(result.current).toBe(before);
    expect(result.current.categories).toBe(before.categories);
  });

  it("o estado vivo é congelado nos testes: escrever fora de uma ação lança erro", async () => {
    const { demo, useDemo } = await freshStore();
    demo.reset();
    const { result } = renderHook(() => useDemo());
    expect(() => (result.current.transactions as unknown[]).push({})).toThrow();
  });
});

describe("rede de segurança do cache", () => {
  it("depois de ações em partes diferentes, todo seletor em cache bate com o cálculo do zero", async () => {
    const store = await freshStore();
    const sel = await import("./selectors");
    store.demo.reset();
    const { result } = renderHook(() => store.useDemo());
    const now = new Date();
    const month = monthOf(spDate(now));
    // Cada leitura passa duas vezes pelo cache (para garantir que vem de lá) e é comparada com um clone,
    // que nunca usa o cache.
    const views: [string, (s: typeof result.current) => unknown][] = [
      ["ledgerMonth", (s) => sel.ledgerMonth(s, month)],
      ["accountsOverview", (s) => sel.accountsOverview(s)],
      ["billsOfMonth", (s) => sel.billsOfMonth(s, month, now)],
      ["reportsView", (s) => sel.reportsView(s, 6, now)],
      ["portfolioView", (s) => sel.portfolioView(s, now)],
      ["dailyAlerts", (s) => sel.dailyAlerts(s, now)],
      ["monthProjection", (s) => sel.monthProjection(s, now)],
      ["installmentsView", (s) => sel.installmentsView(s, now)],
      ["emergencyFundView", (s) => sel.emergencyFundView(s, now)],
      ["limitsView", (s) => sel.limitsView(s, now)],
      ["monthCloseSteps", (s) => store.monthCloseSteps(s, now)],
      ["budgetMonths", (s) => store.budgetMonths(s, month)],
    ];
    const check = (when: string) => {
      for (const [name, read] of views) {
        read(result.current);
        const cached = read(result.current);
        const fresh = read(structuredClone(result.current));
        expect(JSON.parse(JSON.stringify(cached)), `${name} depois de ${when}`).toEqual(JSON.parse(JSON.stringify(fresh)));
      }
    };
    const account = () => result.current.accounts[0]!;
    check("abrir");
    act(() => store.demo.updateProfile({ displayName: "Bia", hideValues: false }));
    check("mudar o perfil");
    act(() => {
      store.demo.addTransaction({ accountId: account().id, date: spDate(now), amount: -12345, payee: "Mercado", categoryId: null });
    });
    check("lançar um gasto");
    act(() => {
      store.demo.saveLimit({ categoryId: null, period: "mes", amount: 1000 });
    });
    check("criar um limite");
    act(() => {
      store.demo.saveAccount({ name: "Poupança nova", kind: "poupanca", openingBalance: 50000 });
    });
    check("criar uma conta");
  });
});
