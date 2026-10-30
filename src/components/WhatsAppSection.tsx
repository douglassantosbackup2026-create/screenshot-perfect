// Perfil › WhatsApp: conectar o número, escolher modo discreto e avisos, e desconectar.
// Aparece só com VITE_WHATSAPP_ENABLED=true (até lá o número da Meta não está configurado).
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { createWhatsAppLink } from "@/lib/whatsapp/link.functions";
import { errMsg } from "@/lib/errors";

export const WHATSAPP_ENABLED = import.meta.env["VITE_WHATSAPP_ENABLED"] === "true";

type Link = { phone: string; discreet: boolean; proactive_opt_in: boolean };

/** Telefone com só o fim visível: 55 11 9•••-0000. */
const maskPhone = (p: string) => `+${p.slice(0, 2)} ${p.slice(2, 4)} •••••-${p.slice(-4)}`;

export function WhatsAppSection() {
  const createLink = useServerFn(createWhatsAppLink);
  const [link, setLink] = useState<Link | null | undefined>(undefined);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("whatsapp_links").select("phone, discreet, proactive_opt_in").maybeSingle();
    if (error) return void toast.error("Não foi possível carregar o WhatsApp agora.");
    setLink(data);
  }
  useEffect(() => {
    void load();
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const r = await createLink();
      if (!r.url) return void toast.error(r.error ?? "Não foi possível gerar o código.");
      setCode(r.code);
      window.open(r.url, "_blank", "noopener");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function setPref(patch: Partial<Pick<Link, "discreet" | "proactive_opt_in">>) {
    if (!link) return;
    setLink({ ...link, ...patch });
    const { error } = await supabase.from("whatsapp_links").update(patch).eq("phone", link.phone);
    if (error) {
      toast.error("Não foi possível salvar. Tente de novo.");
      void load();
    }
  }

  async function disconnect() {
    const { error } = await supabase.from("whatsapp_links").delete().eq("phone", link?.phone ?? "");
    if (error) return void toast.error("Não foi possível desconectar agora.");
    setLink(null);
    setCode(null);
    toast("WhatsApp desconectado. Mensagens desse número não lançam mais nada.");
  }

  return (
    <section className="mt-10" aria-label="WhatsApp">
      <h2 className="flex items-center gap-2 text-lg">
        <MessageCircle size={20} strokeWidth={1.75} className="text-primary" aria-hidden /> WhatsApp
      </h2>
      {link === undefined ? (
        <div className="mt-3 h-20 animate-pulse rounded-2xl bg-card" aria-busy="true" />
      ) : link ? (
        <div className="mt-3 divide-y divide-border">
          <p className="pb-3 text-sm text-muted-foreground">
            Conectado: {maskPhone(link.phone)}. Mande "gastei 62 na farmácia" ou "resumo" para o Mitikos.
          </p>
          <label className="flex min-h-12 items-center justify-between gap-4 py-2">
            <span>
              Modo discreto
              <span className="block text-sm text-muted-foreground">As respostas mostram "R$ •••" em vez dos valores.</span>
            </span>
            <Switch checked={link.discreet} onCheckedChange={(v) => void setPref({ discreet: v })} />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-4 py-2">
            <span>
              Avisos pelo WhatsApp
              <span className="block text-sm text-muted-foreground">Limite estourado, conta a vencer e o resumo da semana.</span>
            </span>
            <Switch checked={link.proactive_opt_in} onCheckedChange={(v) => void setPref({ proactive_opt_in: v })} />
          </label>
          <div className="pt-3">
            <Button variant="ghost" onClick={() => void disconnect()}>
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-card p-5 text-sm shadow-card">
          <p>Lance gastos e veja o resumo do mês mandando mensagem, sem abrir o app.</p>
          <Button className="mt-4 w-full" disabled={busy} onClick={() => void connect()}>
            {busy ? "Gerando…" : "Conectar WhatsApp"}
          </Button>
          {code && (
            <p className="mt-3 text-muted-foreground">
              Se o WhatsApp não abriu, mande <strong className="text-foreground">{code}</strong> para o número do Mitikos. O código vale 10
              minutos.{" "}
              <button type="button" className="min-h-11 font-semibold text-primary" onClick={() => void load()}>
                Já mandei
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
