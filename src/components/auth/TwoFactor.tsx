import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/AuthShell";
import { needsMfaStep, removeTotp, startTotpEnroll, verifiedTotpId, verifyTotp } from "@/lib/auth/mfa";

/**
 * Verificação em duas etapas no Perfil: ativar (QR + código), confirmar o código nesta sessão e desativar.
 * Com `required`, não deixa desativar (hoje nenhuma tela usa: é opcional para todos, inclusive admin).
 */
export function TwoFactor({ required = false }: { required?: boolean }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [pendingStep, setPendingStep] = useState(false);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    try {
      const [id, step] = await Promise.all([verifiedTotpId(), needsMfaStep()]);
      setFactorId(id);
      setPendingStep(step);
    } catch {
      /* sem conexão: a seção fica no estado anterior */
    }
    setLoaded(true);
  }
  useEffect(() => void refresh(), []);

  async function start() {
    setBusy(true);
    try {
      setEnroll(await startTotpEnroll());
    } catch {
      toast.error("Não foi possível começar agora. Tente de novo.");
    }
    setBusy(false);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    const id = enroll?.factorId ?? factorId;
    if (!id) return;
    setBusy(true);
    const ok = await verifyTotp(id, code);
    setBusy(false);
    if (!ok) { toast.error("Código inválido ou vencido. Confira o app e tente de novo."); return; }
    toast.success(enroll ? "Verificação em duas etapas ativada." : "Código confirmado.");
    setEnroll(null); setCode("");
    await refresh();
  }

  async function disable() {
    if (!factorId) return;
    if (required) { toast.error("Contas de administrador precisam manter a verificação em duas etapas."); return; }
    setBusy(true);
    const ok = await removeTotp(factorId);
    setBusy(false);
    if (!ok) { toast.error("Confirme o código desta sessão antes de desativar."); return; }
    toast.success("Verificação em duas etapas desativada.");
    await refresh();
  }

  if (!loaded) return null;
  return (
    <section id="seguranca" className="mt-10 divide-y divide-border">
      <h2 className="pb-2 text-lg">Verificação em duas etapas</h2>
      <div className="space-y-3 py-3">
        {required && !factorId && (
          <p className="text-sm font-semibold text-primary">Obrigatória para administradores: ative para abrir o back-office.</p>
        )}
        {factorId && !pendingStep && (
          <>
            <p className="text-sm text-muted-foreground">Ativa. Cada login pede o código do seu app autenticador.</p>
            {!required && (
              <Button variant="ghost" className="text-destructive" disabled={busy} onClick={disable}>
                Desativar
              </Button>
            )}
          </>
        )}
        {factorId && pendingStep && (
          <form className="space-y-3" onSubmit={confirm}>
            <p className="text-sm text-muted-foreground">Confirme o código do app autenticador para continuar.</p>
            <Field id="mfa-step" label="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
            <Button type="submit" disabled={busy}>{busy ? "Confirmando…" : "Confirmar"}</Button>
          </form>
        )}
        {!factorId && !enroll && (
          <>
            <p className="text-sm text-muted-foreground">
              Além da senha, um código do seu celular (Google Authenticator, Microsoft Authenticator, 1Password…). Protege sua conta mesmo se a senha vazar.
            </p>
            <Button variant="outline" disabled={busy} onClick={start}>Ativar</Button>
          </>
        )}
        {enroll && (
          <form className="space-y-3" onSubmit={confirm}>
            <p className="text-sm text-muted-foreground">Leia o QR com o app autenticador, ou digite a chave. Depois informe o código que aparecer.</p>
            <img src={enroll.qr} alt="QR para o app autenticador" className="h-44 w-44 rounded-xl bg-white p-2" />
            <p className="break-all text-xs text-muted-foreground">Chave: <span className="font-mono">{enroll.secret}</span></p>
            <Field id="mfa-code" label="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>{busy ? "Confirmando…" : "Confirmar e ativar"}</Button>
              <Button type="button" variant="ghost" onClick={() => { setEnroll(null); setCode(""); }}>Cancelar</Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
