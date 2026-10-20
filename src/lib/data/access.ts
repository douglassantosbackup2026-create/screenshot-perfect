// Acesso às funções pagas: liga a chave da cobrança, o modo (demonstração libera tudo) e o plano em vigor.
import { canUse, currentPlan, type Feature, type Plan } from "@/lib/billing";
import { useCloudStatus } from "./cloud";
import { currentBackend } from "./demo-store";

/** Cobrança ligada? Só com VITE_BILLING_ENABLED=true (até lá, tudo liberado e os preços mostram a lista de espera). */
export const BILLING_ENABLED = import.meta.env["VITE_BILLING_ENABLED"] === "true";

export function usePlanAccess() {
  const cloud = useCloudStatus();
  const demo = currentBackend() === "demo";
  const plan: Plan = demo ? "pro" : currentPlan(cloud.entitlement);
  return {
    billing: BILLING_ENABLED && !demo,
    plan,
    entitlement: cloud.entitlement,
    can: (feature: Feature, hasData = false) => canUse(feature, plan, { billing: BILLING_ENABLED && !demo, hasData }),
  };
}
