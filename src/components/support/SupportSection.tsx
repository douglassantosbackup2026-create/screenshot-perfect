// Perfil → Fale conosco: abrir um chamado e acompanhar as respostas da equipe. A pessoa só vê os próprios
// chamados (RLS) e só fala por open_ticket / reply_ticket; situação e responsável são da equipe.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/labels";
import { TICKET_KIND, TICKET_STATUS, type TicketKind, type TicketStatus } from "@/lib/support/labels";
import { errMsg } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Ticket = { id: string; kind: TicketKind; subject: string; status: TicketStatus; updated_at: string; last_reply_by: string };
type Message = { ticket_id: string; author: "usuario" | "equipe"; body: string; at: string };

export function SupportSection() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [kind, setKind] = useState<TicketKind>("duvida");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      supabase.from("support_tickets").select("id, kind, subject, status, updated_at, last_reply_by").order("updated_at", { ascending: false }).limit(20),
      supabase.from("support_messages").select("ticket_id, author, body, at").order("at").limit(200),
    ]);
    setTickets((t.data as Ticket[] | null) ?? []);
    setMessages((m.data as Message[] | null) ?? []);
  }, []);
  useEffect(() => void load(), [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("open_ticket", { p_kind: kind, p_subject: subject, p_body: body });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Recebemos sua mensagem. A resposta aparece aqui.");
    setSubject("");
    setBody("");
    void load();
  }

  async function answer(ticket: string) {
    setBusy(true);
    const { error } = await supabase.rpc("reply_ticket", { p_ticket: ticket, p_body: reply });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    setReply("");
    void load();
  }

  return (
    <section id="fale-conosco" className="mt-10" aria-label="Fale conosco">
      <h2 className="text-xl">Fale conosco</h2>
      <p className="mt-1 text-sm text-muted-foreground">Dúvidas, sugestões, problemas ou pedidos sobre seus dados. A equipe responde aqui.</p>
      <form className="mt-4 space-y-3" onSubmit={send}>
        <Select value={kind} onValueChange={(v) => setKind(v as TicketKind)}>
          <SelectTrigger className="h-11 rounded-xl bg-card" aria-label="Assunto do pedido">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TICKET_KIND) as TicketKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {TICKET_KIND[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="h-11" required minLength={3} maxLength={140} placeholder="Resumo em poucas palavras" aria-label="Resumo" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Textarea required maxLength={4000} rows={4} placeholder="Conte o que aconteceu ou o que você precisa" aria-label="Mensagem" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit" disabled={busy || subject.trim().length < 3 || !body.trim()}>
          Enviar
        </Button>
      </form>

      {tickets && tickets.length > 0 && (
        <ul className="mt-6 space-y-2">
          {tickets.map((t) => {
            const answered = t.last_reply_by === "equipe";
            return (
              <li key={t.id} className={cn("rounded-2xl bg-card shadow-card", answered && open !== t.id && "ring-1 ring-primary/60")}>
                <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{t.subject}</span>
                    <span className="block text-xs text-muted-foreground">
                      {TICKET_KIND[t.kind]} · {formatDate(t.updated_at)}
                      {answered ? " · resposta da equipe" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{TICKET_STATUS[t.status]}</span>
                </button>
                {open === t.id && (
                  <div className="border-t border-border p-4">
                    <ol className="space-y-2">
                      {messages
                        .filter((m) => m.ticket_id === t.id)
                        .map((m, i) => (
                          <li key={i} className={cn("rounded-xl p-3 text-sm", m.author === "equipe" ? "mr-6 bg-primary/10" : "ml-6 bg-muted")}>
                            <p className="text-xs text-muted-foreground">
                              {m.author === "equipe" ? "Equipe" : "Você"} · {formatDate(m.at)}
                            </p>
                            <p className="mt-1 whitespace-pre-line">{m.body}</p>
                          </li>
                        ))}
                    </ol>
                    <div className="mt-3 flex gap-2">
                      <Input className="h-11 min-w-0 flex-1" maxLength={4000} placeholder="Responder" aria-label="Responder" value={reply} onChange={(e) => setReply(e.target.value)} />
                      <Button disabled={busy || !reply.trim()} onClick={() => answer(t.id)}>
                        Enviar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
