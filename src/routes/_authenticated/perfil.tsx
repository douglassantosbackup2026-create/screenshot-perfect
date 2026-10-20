import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberField } from "@/components/forms";
import { ACH_ICONS, handleResult } from "@/components/feedback";
import { demo, useDemo } from "@/lib/data/demo-store";
import { ACHIEVEMENTS, LEVELS } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Previdência Intelligence" },
      { name: "description", content: "Seu nível, conquistas, lembretes e preferências de privacidade." },
      { property: "og:title", content: "Perfil — Previdência Intelligence" },
      { property: "og:description", content: "Seu nível, conquistas, lembretes e privacidade." },
    ],
  }),
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
  const [confirm, setConfirm] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false);
  const earned = new Set(s.achievements.map((a) => a.code));

  function exportData() {
    const blob = new Blob([JSON.stringify(demo.exportData(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "meus-dados-previdencia-intelligence.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-3xl lg:px-8 lg:pb-12">
      <h1>{s.profile.displayName || "Perfil"}</h1>

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

      <section className="mt-10 divide-y divide-border">
        <h2 className="pb-2 text-lg">Reserva e lembretes</h2>
        <Row label="Minha reserva de emergência está montada">
          <Switch
            checked={s.profile.emergencyFundReady}
            onCheckedChange={(v) => handleResult(demo.setEmergencyFund(v))}
          />
        </Row>
        <Row label="Lembrete mensal do aporte">
          <Switch checked={s.profile.monthlyReminder} onCheckedChange={(v) => demo.updateProfile({ monthlyReminder: v })} />
        </Row>
        {s.profile.monthlyReminder && (
          <div className="py-3">
            <NumberField
              label="Dia do mês"
              value={s.profile.reminderDay}
              onChange={(v) => {
                if (v == null) return;
                if (Number.isInteger(v) && v >= 1 && v <= 28) demo.updateProfile({ reminderDay: v });
                else toast.error("Escolha um dia entre 1 e 28: assim o lembrete existe em todos os meses.");
              }}
              min={1}
              max={28}
              step={1}
              hint="Entre 1 e 28."
            />
          </div>
        )}
        <Row label="Lembrete semanal da missão">
          <Switch checked={s.profile.weeklyReminder} onCheckedChange={(v) => demo.updateProfile({ weeklyReminder: v })} />
        </Row>
      </section>

      <section className="mt-10 divide-y divide-border">
        <h2 className="pb-2 text-lg">Privacidade</h2>
        <Row label="Ocultar valores por padrão" hint="Diário e Evolução abrem com os valores escondidos.">
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
        <Link to="/sobre" className="min-h-11 py-3">Política de privacidade</Link>
        <Link to="/sobre" className="min-h-11 py-3">Sobre o app</Link>
        <Link to="/admin/conteudo" className="min-h-11 py-3">Admin de conteúdo</Link>
        {/* Restaurar apaga o que a pessoa registrou: pede um segundo toque antes. */}
        <button
          type="button"
          className={cn("min-h-11 py-3 text-left", confirmRestore && "font-semibold text-destructive")}
          onClick={() => {
            if (!confirmRestore) return setConfirmRestore(true);
            demo.reset();
            setConfirmRestore(false);
            toast("Dados de exemplo restaurados.");
          }}
          onBlur={() => setConfirmRestore(false)}
        >
          {confirmRestore ? "Toque de novo: isso substitui tudo o que você registrou" : "Restaurar dados de exemplo"}
        </button>
        <Link to="/" className="min-h-11 py-3 font-semibold text-primary">Sair</Link>
      </nav>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir minha conta</DialogTitle>
            <DialogDescription>
              Isso apaga seu plano, seus registros e seu progresso. Não dá para desfazer. Digite EXCLUIR para confirmar.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="confirm" className="sr-only">Digite EXCLUIR</label>
          <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={confirm !== "EXCLUIR"}
              onClick={() => {
                demo.startFresh();
                setDelOpen(false);
                navigate({ to: "/" });
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
