import { useEffect, useState } from "react";
import { isAdmin } from "@/lib/auth/roles";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberField } from "@/components/forms";
import { ACH_ICONS, handleResult } from "@/components/feedback";
import { demo, detachUser, flushSave, stopSync, useDemo } from "@/lib/data/demo-store";
import { supabase } from "@/integrations/supabase/client";
import { ACHIEVEMENTS, LEVELS } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";
import { ChangePassword } from "@/components/auth/ChangePassword";
import { JOURNEY_ENABLED } from "@/lib/features";
import { pageHead } from "@/lib/seo";
import { useServerFn } from "@tanstack/react-start";
import { cancelSubscription } from "@/lib/billing/subscription.functions";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => pageHead(
      "Perfil",
      JOURNEY_ENABLED ? "Seu nível, conquistas, lembretes e preferências de privacidade." : "Sua rotina do mês e preferências de privacidade.",
      JOURNEY_ENABLED ? "Seu nível, conquistas, lembretes e privacidade." : "Sua rotina e privacidade.",
    ),
  component: Profile,
});

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4 py-2">
      <span>
        {label}
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Profile() {
  const s = useDemo();
  const navigate = useNavigate();
  const [delOpen, setDelOpen] = useState(false);
  // O dia é digitado aqui e só vai para o store quando a pessoa para de digitar: "30" não passa pelo "3",
  // e cada tecla não regrava (nem re-renderiza) o app inteiro.
  const [reminderDay, setReminderDay] = useState<number | null>(s.profile.reminderDay);
  useEffect(() => {
    if (reminderDay == null || reminderDay === s.profile.reminderDay) return;
    const t = setTimeout(() => {
      if (Number.isInteger(reminderDay) && reminderDay >= 1 && reminderDay <= 28) demo.updateProfile({ reminderDay });
      else toast.error("Escolha um dia entre 1 e 28: assim ele existe em todos os meses.");
    }, 700);
    return () => clearTimeout(t);
  }, [reminderDay, s.profile.reminderDay]);
  const cancelAtMercadoPago = useServerFn(cancelSubscription);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [admin, setAdmin] = useState(false);
  useEffect(() => void isAdmin().then(setAdmin), []);
  async function signOut() {
    if (!(await flushSave())) {
      toast.error("Sua última alteração ainda não foi salva. Confira a internet e tente sair de novo.");
      return;
    }
    const { error } = await supabase.auth.signOut();
    // Sem internet, a sessão local sai do mesmo jeito; só a do servidor expira sozinha depois.
    if (error) toast("Você saiu deste aparelho. Sem conexão, a sessão no servidor expira sozinha.");
    detachUser();
    navigate({ to: "/", replace: true });
  }
  const earned = new Set(s.achievements.map((a) => a.code));

  function exportData() {
    const blob = new Blob([JSON.stringify(demo.exportData(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "meus-dados-mitikos.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-3xl lg:px-8 lg:pb-12">
      <h1>{s.profile.displayName || "Perfil"}</h1>

      {JOURNEY_ENABLED && (
      <>
      <section className="mt-8" aria-label="Níveis">
        <h2 className="text-lg">Seu nível</h2>
        <ol className="mt-4 space-y-2">
          {LEVELS.map((l) => {
            const current = l.level === s.stats.level;
            const reached = l.level <= s.stats.level;
            return (
              <li
                key={l.level}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4",
                  current ? "border-primary bg-card" : "border-border",
                )}
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={cn(
                    "font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2",
                    reached ? "border-primary text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  {reached ? l.level : <Lock size={16} strokeWidth={1.75} aria-label="Bloqueado" />}
                </span>
                <div>
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-sm text-muted-foreground">{l.minXp === 0 ? "Ao começar a jornada" : `A partir de ${l.minXp} XP`}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="money">{s.stats.totalXp}</span> XP · melhor sequência: {s.stats.bestDayStreak} {s.stats.bestDayStreak === 1 ? "dia" : "dias"} · {s.stats.bestWeekStreak}{" "}
          {s.stats.bestWeekStreak === 1 ? "semana" : "semanas"}
        </p>
      </section>

      <section className="mt-10" aria-label="Conquistas">
        <h2 className="text-lg">Conquistas</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const Icon = ACH_ICONS[a.icon] ?? Lock;
            const got = earned.has(a.code);
            return (
              <li key={a.code} className="rounded-2xl bg-card shadow-card p-4">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    got ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold">{a.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {got ? "Conquistada" : a.description}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
      </>
      )}

      <section className="mt-10 divide-y divide-border">
        <h2 className="pb-2 text-lg">Reserva e rotina</h2>
        <Row label="Minha reserva de emergência está montada">
          <Switch
            checked={s.profile.emergencyFundReady}
            onCheckedChange={(v) => handleResult(demo.setEmergencyFund(v))}
          />
        </Row>
        {/* Lembretes por notificação ou e-mail ainda não existem: só o aviso dentro do app usa este dia. */}
        <div className="py-3">
          <NumberField
            label="Dia em que você recebe"
            value={reminderDay}
            onChange={setReminderDay}
            min={1}
            max={28}
            step={1}
            hint="A partir desse dia, o Início lembra de registrar o aporte e o patrimônio do mês."
          />
        </div>
      </section>

      <section className="mt-10 divide-y divide-border">
        <h2 className="pb-2 text-lg">Privacidade</h2>
        <Row label="Ocultar valores por padrão" hint="Lançamentos, Patrimônio e Progresso abrem com os valores escondidos.">
          <Switch checked={s.profile.hideValues} onCheckedChange={(v) => demo.updateProfile({ hideValues: v })} />
        </Row>
        <Row label="Permitir dados de uso anônimos" hint="Nunca inclui valores financeiros.">
          <Switch checked={s.profile.analyticsConsent} onCheckedChange={(v) => demo.updateProfile({ analyticsConsent: v })} />
        </Row>
        <div className="flex flex-col gap-2 pt-4">
          <Button variant="outline" onClick={exportData}>
            Baixar meus dados
          </Button>
          <Button variant="ghost" className="text-destructive" onClick={() => setDelOpen(true)}>
            Excluir minha conta
          </Button>
        </div>
      </section>

      <nav className="mt-10 flex flex-col border-t border-border pt-4 text-sm" aria-label="Links">
        <Link to="/sobre" className="min-h-11 py-3">Termos de uso</Link>
        <Link to="/planos" className="min-h-11 py-3 font-semibold text-primary">Sua assinatura</Link>
        <Link to="/privacidade" className="min-h-11 py-3">Política de privacidade</Link>
        <Link to="/sobre" className="min-h-11 py-3">Sobre o app</Link>
        {admin && <Link to="/admin/conteudo" className="min-h-11 py-3">Admin de conteúdo</Link>}
        <ChangePassword />
        <button type="button" className="min-h-11 py-3 text-left font-semibold text-primary" onClick={signOut}>
          Sair
        </button>
      </nav>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir minha conta</DialogTitle>
            <DialogDescription>
              Isso cancela sua assinatura e apaga seu plano, seus registros e seu progresso. Não dá para desfazer. Digite EXCLUIR para confirmar.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="confirm" className="sr-only">Digite EXCLUIR</label>
          <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={confirm !== "EXCLUIR" || deleting}
              onClick={async () => {
                setDeleting(true);
                // Cancela a assinatura antes: apagar a conta não pode deixar o cartão sendo cobrado.
                const cancelled = await cancelAtMercadoPago().catch(() => ({ error: "falhou" }));
                if (cancelled.error) {
                  setDeleting(false);
                  toast.error("Não foi possível cancelar sua assinatura agora, então a conta não foi excluída. Tente de novo.");
                  return;
                }
                // Nenhuma gravação pode chegar depois da exclusão e recriar os dados.
                await stopSync();
                const { error } = await supabase.rpc("delete_my_account");
                setDeleting(false);
                if (error) {
                  // A sincronização foi parada; recarregar religa tudo do jeito certo (rota → attachUser),
                  // em vez de deixar as próximas edições presas só neste aparelho.
                  toast.error("Não foi possível excluir agora. Seus dados continuam salvos. Tente de novo.");
                  setTimeout(() => window.location.reload(), 1500);
                  return;
                }
                setDelOpen(false);
                await supabase.auth.signOut();
                detachUser();
                navigate({ to: "/", replace: true });
                toast("Sua conta e seus dados foram apagados.");
              }}
            >
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
