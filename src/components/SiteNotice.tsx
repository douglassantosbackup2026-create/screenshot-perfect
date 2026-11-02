// Aviso no topo do app e da página inicial (publicado pela equipe em Painel → Conteúdos). Só o mais recente
// ativo; a pessoa pode fechar, e o mesmo aviso não volta neste navegador.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Notice = { id: string; text: string; link: string | null };
const KEY = "mk_notice_closed";

export function SiteNotice() {
  const [n, setN] = useState<Notice | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.resolve(supabase.from("site_notices").select("id, text, link").order("created_at", { ascending: false }).limit(1)).then(
      ({ data }) => {
        const first = data?.[0];
        let closed: string | null = null;
        try {
          closed = window.localStorage.getItem(KEY);
        } catch {
          /* sem armazenamento: mostra */
        }
        if (live && first && first.id !== closed) setN(first);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  if (!n) return null;
  const close = () => {
    try {
      window.localStorage.setItem(KEY, n.id);
    } catch {
      /* fecha só nesta tela */
    }
    setN(null);
  };
  const text = <span className="min-w-0 flex-1">{n.text}</span>;
  return (
    <div role="status" className="flex items-center gap-2 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
      {n.link ? (
        n.link.startsWith("/") ? (
          <Link to={n.link} className="min-w-0 flex-1 underline-offset-4 hover:underline">
            {n.text}
          </Link>
        ) : (
          <a href={n.link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 underline-offset-4 hover:underline">
            {n.text}
          </a>
        )
      ) : (
        text
      )}
      <button type="button" onClick={close} aria-label="Fechar aviso" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/10">
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
