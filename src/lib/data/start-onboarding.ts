import { supabase } from "@/integrations/supabase/client";
import { demo, setCalcPrefill, type CalcPrefill } from "@/lib/data/demo-store";

export type StartTarget = { to: "/hoje" } | { to: "/cadastro"; search: { redirect: string } };

/**
 * O "Começar grátis" da landing e da calculadora. Quem já tem conta vai para o app: começar do zero
 * apagaria os dados dela no banco. Quem não tem leva os números da conta e vai direto criar a conta
 * (não para o login), seguindo depois para o onboarding.
 */
export async function startOnboarding(prefill: CalcPrefill | null, go: (target: StartTarget) => void) {
  const { data } = await supabase.auth.getSession();
  if (data.session) return go({ to: "/hoje" });
  setCalcPrefill(prefill);
  demo.startFresh();
  go({ to: "/cadastro", search: { redirect: "/onboarding" } });
}
