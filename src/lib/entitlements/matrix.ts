// Quem pode usar o app e o que a assinatura inclui. Não existe plano grátis: sem assinatura válida,
// a pessoa só vê a tela de Assinatura e o Perfil. O guard de src/routes/_authenticated lê daqui.
// Com a cobrança desligada (VITE_BILLING_ENABLED ausente), todo mundo entra, como antes do lançamento.

import { z } from "zod";

export type Tier = "inteligencia" | "pro";
export const TIER_ORDER: Tier[] = ["inteligencia", "pro"];

export type FeatureKey = "what_if" | "goal_seek" | "progress_corridor" | "month_projection" | "anomaly_alerts" | "custom_limits" | "xray";

export type Feature = {
  key: FeatureKey;
  /** Área da tela onde o recurso aparece. */
  area: "Plano" | "Progresso" | "Dinheiro" | "Patrimônio";
  /** Nome curto do recurso. */
  label: string;
  /** Uma linha explicando o que o recurso faz (mostrada na tela de Assinatura). */
  upsell: string;
};

export const FEATURES: Record<FeatureKey, Feature> = {
  what_if: {
    key: "what_if",
    area: "Plano",
    label: 'Simulação "E se…?"',
    upsell: "Teste mudanças no plano lado a lado com o atual, sem alterar nada até você decidir.",
  },
  goal_seek: {
    key: "goal_seek",
    area: "Plano",
    label: "Com quantos anos posso parar?",
    upsell: "Descubra a menor idade em que seu patrimônio já paga a renda que você quer.",
  },
  progress_corridor: {
    key: "progress_corridor",
    area: "Progresso",
    label: "Projetado × real",
    upsell:
      "Compare o patrimônio que você registra com o que o plano previa e veja se está no ritmo.",
  },
  month_projection: {
    key: "month_projection",
    area: "Dinheiro",
    label: "Fim do mês",
    upsell: "Veja quanto deve sobrar no fim do mês e em que dia o saldo fica mais apertado.",
  },
  anomaly_alerts: {
    key: "anomaly_alerts",
    area: "Dinheiro",
    label: "Avisos de cobranças",
    upsell:
      "Saiba na hora quando uma cobrança vem repetida, uma assinatura sobe de preço ou a fatura passa da média.",
  },
  custom_limits: {
    key: "custom_limits",
    area: "Dinheiro",
    label: "Limites de gasto ilimitados",
    upsell: "Crie quantos limites quiser, por categoria e por dia, semana, quinzena ou mês.",
  },
  xray: {
    key: "xray",
    area: "Patrimônio",
    label: "Raio-X do patrimônio",
    upsell: "Veja concentração, liquidez e o que falta nos seus dados, com o que fazer primeiro.",
  },
};

export type Access = {
  /** Plano em vigor; null sem assinatura válida. */
  tier: Tier | null;
  /** Pode usar o app. */
  active: boolean;
  /** Cobrança desligada: todo mundo entra, sem assinatura. */
  billingOff: boolean;
};

export type Entitlement = { plan: string; validUntil: string };

const isTier = (p: string): p is Tier => (TIER_ORDER as string[]).includes(p);

/** Acesso da pessoa: com cobrança desligada, entra; com cobrança, só com assinatura dentro da validade. */
export function resolveAccess(opts: {
  billingEnabled: boolean;
  entitlement: Entitlement | null;
  now?: Date;
}): Access {
  if (!opts.billingEnabled) return { tier: null, active: true, billingOff: true };
  const e = opts.entitlement;
  const valid =
    !!e && isTier(e.plan) && new Date(e.validUntil).getTime() > (opts.now ?? new Date()).getTime();
  return { tier: valid ? (e.plan as Tier) : null, active: valid, billingOff: false };
}

/** Quanto tempo a última assinatura lida do banco vale quando a consulta falha. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CachedEntitlement = z.object({
  plan: z.string().max(32),
  validUntil: z.string().datetime({ offset: true }),
  checkedAt: z.number().int().positive(),
});

/**
 * Lê a assinatura guardada no aparelho. Só vale se tiver o formato certo e tiver sido conferida no banco
 * nas últimas 24 h; qualquer outra coisa (vazio, adulterado, velho) é tratada como "sem assinatura".
 */
export function entitlementFromCache(raw: string | null, now = Date.now()): Entitlement | null {
  if (!raw) return null;
  try {
    const c = CachedEntitlement.parse(JSON.parse(raw));
    if (c.checkedAt > now || now - c.checkedAt > CACHE_TTL_MS) return null;
    return { plan: c.plan, validUntil: c.validUntil };
  } catch {
    return null;
  }
}
