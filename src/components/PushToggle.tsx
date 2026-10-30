// Liga e desliga as notificações deste aparelho (lembrete do fechamento do mês no dia escolhido).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { disablePush, enablePush, pushEnabled, pushSupport, type PushSupport } from "@/lib/push/client";

const HINT: Record<Exclude<PushSupport, "ok">, string> = {
  "install-first": "No iPhone, instale o app antes: Compartilhar → Adicionar à Tela de Início. Depois ligue aqui.",
  unsupported: "Este navegador não recebe notificações do app.",
  "not-configured": "As notificações ainda não estão disponíveis.",
};

export function PushToggle() {
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s === "ok") void pushEnabled().then(setOn);
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user.id;
        const err = id ? await enablePush(id) : "Entre na sua conta para ligar as notificações.";
        if (err) toast.error(err);
        else {
          setOn(true);
          toast.success("Pronto. Avisamos no dia do fechamento.");
        }
      } else {
        await disablePush();
        setOn(false);
      }
    } catch {
      toast.error("Não foi possível mudar as notificações agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-3">
      <span>
        <span className="block">Notificações neste aparelho</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {support === "ok" ? "Um lembrete no dia escolhido para fechar o mês. Nunca mostra valores." : HINT[support]}
        </span>
      </span>
      <Switch checked={on} disabled={busy || support !== "ok"} onCheckedChange={(v) => void toggle(v)} aria-label="Notificações neste aparelho" />
    </div>
  );
}
