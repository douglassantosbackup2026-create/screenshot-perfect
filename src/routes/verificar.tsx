import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { safePath } from "@/lib/auth/password";
import { needsMfaStep, verifiedTotpId, verifyTotp } from "@/lib/auth/mfa";
import { pageHead } from "@/lib/seo";

// Segunda etapa do login: quem ativou a verificação em duas etapas cai aqui depois da senha.
export const Route = createFileRoute("/verificar")({
  ssr: false,
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => pageHead("Verificação", "Confirme o código do seu app autenticador.", "Confirme o código do app autenticador."),
  component: Verify,
});

function Verify() {
  const { redirect: target } = Route.useSearch();
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return navigate({ to: "/entrar", search: { redirect: safePath(target) }, replace: true });
      if (!(await needsMfaStep())) return navigate({ to: safePath(target), replace: true });
      setFactorId(await verifiedTotpId().catch(() => null));
    })();
  }, [navigate, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    const ok = await verifyTotp(factorId, code);
    setBusy(false);
    if (!ok) { toast.error("Código inválido ou vencido. Confira o app e tente de novo."); return; }
    navigate({ to: safePath(target), replace: true });
  }

  async function other() {
    await supabase.auth.signOut();
    navigate({ to: "/entrar", search: { redirect: safePath(target) }, replace: true });
  }

  return (
    <AuthShell title="Verificação em duas etapas" subtitle="Digite o código de 6 dígitos do seu app autenticador.">
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Field id="code" label="Código" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy || !factorId}>{busy ? "Confirmando…" : "Confirmar"}</Button>
      </form>
      <button type="button" className="mt-6 text-sm font-semibold text-primary" onClick={other}>
        Entrar com outra conta
      </button>
    </AuthShell>
  );
}
