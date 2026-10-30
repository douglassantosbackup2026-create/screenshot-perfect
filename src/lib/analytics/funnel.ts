// Monta o funil a partir das linhas de admin_funnel (etapa × origem × pessoas). Função pura.

export const FUNNEL_STEPS = [
  { key: "landing_view", label: "Visitou a página inicial" },
  { key: "calculator_used", label: "Usou a calculadora" },
  { key: "lead_saved", label: "Deixou o e-mail" },
  { key: "signup_completed", label: "Criou a conta" },
  { key: "checkout_started", label: "Abriu o pagamento" },
  { key: "subscription_authorized", label: "Assinou" },
] as const;

export type FunnelRow = { step: string; source: string; people: number };
export type FunnelStep = {
  key: string;
  label: string;
  people: number;
  /** Fração da etapa anterior (null na primeira ou se a anterior teve zero). */
  fromPrevious: number | null;
  /** Fração da primeira etapa. */
  fromFirst: number | null;
};

export function buildFunnel(rows: FunnelRow[], source: string | null = null): FunnelStep[] {
  const count = (key: string) => rows.filter((r) => r.step === key && (source === null || r.source === source)).reduce((t, r) => t + Number(r.people), 0);
  const steps = FUNNEL_STEPS.map((s) => ({ key: s.key, label: s.label, people: count(s.key) }));
  const first = steps[0]?.people ?? 0;
  return steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1]!.people : 0;
    return {
      ...s,
      fromPrevious: i > 0 && prev > 0 ? s.people / prev : null,
      fromFirst: first > 0 ? s.people / first : null,
    };
  });
}

/** Origens com mais pessoas primeiro (pela primeira etapa em que aparecem). */
export function funnelSources(rows: FunnelRow[]): { source: string; people: number }[] {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.source, Math.max(by.get(r.source) ?? 0, Number(r.people)));
  return [...by].map(([source, people]) => ({ source, people })).sort((a, b) => b.people - a.people || a.source.localeCompare(b.source));
}
