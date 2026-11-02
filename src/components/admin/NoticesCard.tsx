// Painel → Conteúdos: aviso exibido no topo do app e da página inicial (src/components/SiteNotice.tsx).
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, Loading, STATUS_PILL } from "@/components/admin/kit";
import { useAdminData } from "@/components/admin/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/labels";
import { errMsg } from "@/lib/errors";

type Notice = { id: string; text: string; link: string | null; active: boolean; until: string | null; created_at: string };

export function NoticesCard({ canWrite }: { canWrite: boolean }) {
  const { data, reload, failed } = useAdminData<Notice[]>(() => supabase.rpc("admin_list_notices"), []);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(n: { id: string | null; text: string; link: string | null; active: boolean; until: string | null }, ok: string) {
    setBusy(true);
    // O gerador de tipos não marca como nulos os parâmetros sem default, mas a função aceita null (aviso novo, sem link, sem prazo).
    const { error } = await supabase.rpc("admin_save_notice", { p_id: n.id as string, p_text: n.text, p_link: n.link as string, p_active: n.active, p_until: n.until as string });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success(ok);
    setText("");
    setLink("");
    setUntil("");
    reload();
  }

  return (
    <Card title="Aviso no app" note="Faixa no topo da página inicial e do app. Aparece o aviso ativo mais recente; cada pessoa pode fechar.">
      {canWrite && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              { id: null, text, link: link.trim() || null, active: true, until: until ? new Date(`${until}T23:59:59-03:00`).toISOString() : null },
              "Aviso publicado.",
            );
          }}
        >
          <Input className="h-11" required minLength={3} maxLength={240} placeholder="Texto do aviso" aria-label="Texto do aviso" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Input className="h-11 min-w-0 flex-1" placeholder="Link (opcional: /planos ou https://…)" aria-label="Link do aviso" value={link} onChange={(e) => setLink(e.target.value)} />
            <Input className="h-11 w-44" type="date" aria-label="Mostrar até" value={until} onChange={(e) => setUntil(e.target.value)} />
            <Button type="submit" disabled={busy || text.trim().length < 3}>
              Publicar
            </Button>
          </div>
        </form>
      )}
      {!data ? (
        <Loading failed={failed} onRetry={reload} />
      ) : (
        <ul className="mt-3 divide-y divide-border text-sm">
          {data.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block">{n.text}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(n.created_at)}
                  {n.until ? ` · até ${formatDate(n.until)}` : ""}
                  {n.link ? ` · ${n.link}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className={STATUS_PILL}>{n.active ? "Ativo" : "Desligado"}</span>
                {canWrite && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => save({ ...n, active: !n.active }, n.active ? "Aviso desligado." : "Aviso religado.")}>
                    {n.active ? "Desligar" : "Religar"}
                  </Button>
                )}
              </span>
            </li>
          ))}
          {!data.length && <li className="py-2 text-muted-foreground">Nenhum aviso publicado.</li>}
        </ul>
      )}
    </Card>
  );
}
