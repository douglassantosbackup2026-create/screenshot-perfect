import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addMonths, monthOf, spDate } from "@/lib/gamification/rules";

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
    for (const k of ["wealthEntries", "goals", "challenges", "days", "assets", "assetValuations", "accounts", "categories", "transactions", "recurring", "categoryRules"]) delete v1[k];
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
    expect(s.version).toBe(6);
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
    expect(demo.importTransactions(cc, rows)).toEqual({ added: 1, matched: 1, duplicates: 0 });
    const s = state();
    expect(s.transactions).toHaveLength(2);
    expect(s.transactions[0]).toMatchObject({ payee: "Mercado", categoryId: "cat-mercado", importedId: "F1" });
    expect(s.transactions[1]).toMatchObject({ source: "importado", importedId: "F2", note: "NF 1" });
    expect(demo.importTransactions(cc, rows)).toEqual({ added: 0, matched: 0, duplicates: 2 });
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
