import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/auth/AuthShell";
import { submitContact } from "@/lib/support/contact.functions";
import { TICKET_KIND, type TicketKind } from "@/lib/support/labels";
import { pageHead } from "@/lib/seo";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/contato")({
  head: () => pageHead("Contato", "Fale com a equipe: dúvidas, sugestões, problemas e pedidos sobre seus dados.", "Fale com a equipe."),
  component: Contact,
});

function Contact() {
  const send = useServerFn(submitContact);
  const [form, setForm] = useState({ name: "", email: "", subject: "", body: "" });
  const [kind, setKind] = useState<TicketKind>("duvida");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await send({ data: { ...form, kind } });
      if (r.error) toast.error(r.error);
      else setSent(true);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-8">
      <Link to="/" className="text-sm font-semibold text-primary">
        Voltar ao início
      </Link>
      <h1 className="mt-6">Fale com a equipe</h1>
      <p className="mt-4 text-muted-foreground">
        Tem conta? Entre e use <strong>Perfil → Fale conosco</strong>: a resposta aparece lá. Sem conta, escreva aqui e respondemos pelo e-mail.
      </p>
      {sent ? (
        <section className="mt-8 rounded-2xl bg-card p-6 shadow-card" role="status">
          <h2 className="text-lg">Mensagem recebida</h2>
          <p className="mt-2 text-sm text-muted-foreground">Respondemos pelo e-mail informado. Não precisa mandar de novo.</p>
        </section>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={submit}>
          <Field id="name" label="Nome" autoComplete="name" maxLength={120} value={form.name} onChange={set("name")} />
          <Field id="email" label="E-mail" type="email" required autoComplete="email" maxLength={254} value={form.email} onChange={set("email")} />
          <div className="space-y-1.5">
            <span className="text-sm font-semibold">Sobre o quê?</span>
            <Select value={kind} onValueChange={(v) => setKind(v as TicketKind)}>
              <SelectTrigger className="h-11 rounded-xl bg-muted" aria-label="Sobre o quê">
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
          </div>
          <Field id="subject" label="Assunto" required minLength={3} maxLength={140} value={form.subject} onChange={set("subject")} />
          <div className="space-y-1.5">
            <label htmlFor="body" className="text-sm font-semibold">
              Mensagem
            </label>
            <Textarea id="body" required maxLength={4000} rows={5} value={form.body} onChange={set("body")} />
          </div>
          <p className="text-xs text-muted-foreground">
            Usamos estes dados só para responder. Veja a{" "}
            <Link to="/privacidade" className="font-semibold text-primary">
              política de privacidade
            </Link>
            .
          </p>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Enviando…" : "Enviar"}
          </Button>
        </form>
      )}
    </main>
  );
}
