// Matriz de recursos × plano: a única fonte do que cada plano libera.
// O gate das telas, o modal de upgrade e o destaque do plano mínimo leem daqui.
// Enquanto a cobrança está desligada (lançamento), tudo fica liberado e o modal não aparece.

export type Tier = "free" | "inteligencia" | "pro";
export const TIER_ORDER: Tier[] = ["free", "inteligencia", "pro"];

export type FeatureKey = "what_if" | "goal_seek" | "progress_corridor" | "month_projection" | "anomaly_alerts" | "custom_limits" | "xray";

export type Feature = {
  key: FeatureKey;
  /** Área da tela onde o recurso aparece. */
  area: "Plano" | "Progresso" | "Dia a dia" | "Patrimônio";
  /** Nome curto mostrado no modal ("Você queria usar: …"). */
  label: string;
  /** Linha do modal explicando o que o upgrade libera. */
  upsell: string;
  minTier: Tier;
};

export const FEATURES: Record<FeatureKey, Feature> = {
  what_if: {
    key: "what_if",
    area: "Plano",
    label: 'Simulação "E se…?"',
    upsell: "Teste mudanças no plano lado a lado com o atual, sem alterar nada até você decidir.",
    minTier: "inteligencia",
  },
  goal_seek: {
    key: "goal_seek",
    area: "Plano",
    label: "Com quantos anos posso parar?",
    upsell: "Descubra a menor idade em que seu patrimônio já paga a renda que você quer.",
    minTier: "inteligencia",
  },
  progress_corridor: {
    key: "progress_corridor",
    area: "Progresso",
    label: "Projetado × real",
    upsell:
      "Compare o patrimônio que você registra com o que o plano previa e veja se está no ritmo.",
    minTier: "inteligencia",
  },
  // Avisos de orçamento, parcelas e reserva de emergência são do plano gratuito e não precisam de entrada aqui.
  month_projection: {
    key: "month_projection",
    area: "Dia a dia",
    label: "Fim do mês",
    upsell: "Veja quanto deve sobrar no fim do mês e em que dia o saldo fica mais apertado.",
    minTier: "inteligencia",
  },
  anomaly_alerts: {
    key: "anomaly_alerts",
    area: "Dia a dia",
    label: "Avisos de cobranças",
    upsell:
      "Saiba na hora quando uma cobrança vem repetida, uma assinatura sobe de preço ou a fatura passa da média.",
    minTier: "inteligencia",
  },
  custom_limits: {
    key: "custom_limits",
    area: "Dia a dia",
    label: "Limites de gasto ilimitados",
    upsell: "Crie quantos limites quiser, por categoria e por dia, semana, quinzena ou mês.",
    minTier: "inteligencia",
  },
  xray: {
    key: "xray",
    area: "Patrimônio",
    label: "Raio-X do patrimônio",
    upsell: "Veja concentração, liquidez e o que falta nos seus dados, com o que fazer primeiro.",
    minTier: "inteligencia",
  },
};

/** No plano gratuito dá para ter este número de limites de gasto; acima disso, só com "custom_limits". */
export const FREE_SPEND_LIMITS = 1;

export function canCreateLimit(currentCount: number, access: Access): boolean {
  return currentCount < FREE_SPEND_LIMITS || canUse("custom_limits", access);
}

export type Access = {
  tier: Tier;
  /** Lançamento: cobrança desligada, todos os recursos liberados. */
  launchOpen: boolean;
};

export type Entitlement = { plan: string; validUntil: string };

const isTier = (p: string): p is Tier => (TIER_ORDER as string[]).includes(p);

/** Plano da pessoa: com cobrança desligada, tudo liberado; com cobrança, só vale direito pago e dentro da validade. */
export function resolveAccess(opts: {
  billingEnabled: boolean;
  entitlement: Entitlement | null;
  now?: Date;
}): Access {
  if (!opts.billingEnabled) return { tier: "free", launchOpen: true };
  const e = opts.entitlement;
  const valid =
    e && isTier(e.plan) && new Date(e.validUntil).getTime() > (opts.now ?? new Date()).getTime();
  return { tier: valid ? (e.plan as Tier) : "free", launchOpen: false };
}

export function canUse(key: FeatureKey, access: Access): boolean {
  return (
    access.launchOpen ||
    TIER_ORDER.indexOf(access.tier) >= TIER_ORDER.indexOf(FEATURES[key].minTier)
  );
}

/** Recursos liberados por um plano, na ordem da matriz (para listar nos cards de preço). */
export function featuresOf(tier: Tier): Feature[] {
  return Object.values(FEATURES).filter(
    (f) => TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(f.minTier),
  );
}
