import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/auth/AuthShell";
import { applyAffiliate } from "@/lib/affiliates/affiliates.functions";
import { pageHead, APP_NAME } from "@/lib/seo";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/parceiros")({
  head: () =>
    pageHead(
      "Programa de parceiros",
      `Indique o ${APP_NAME} e ganhe comissão a cada pagamento de quem assinar pelo seu link.`,
      "Indique e ganhe comissão.",
    ),
  component: Affiliates,
});

const STEPS = [
  "Você se inscreve aqui. A equipe analisa e responde.",
  "Aprovado, você recebe um código e um link só seus.",
  "Quem cria a conta pelo seu link (ou digita seu código no cadastro) fica ligado a você.",
  "A cada pagamento aprovado dessa pessoa, você ganha a comissão combinada, paga por Pix.",
];

function Affiliates() {
  const apply = useServerFn(applyAffiliate);
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", instagram: "", pixKey: "", message: "" });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) return void toast.error("Aceite os termos para enviar.");
    setBusy(true);
    try {
      const r = await apply({ data: { ...form, terms: true } });
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
      <h1 className="mt-6">Programa de parceiros</h1>
      <p className="mt-4">Indique o {APP_NAME} para quem quer organizar o dinheiro e ganhe comissão a cada pagamento de quem assinar por você.</p>
      <ol className="mt-6 space-y-3">
        {STEPS.map((s, i) => (
          <li key={s} className="flex gap-3 rounded-2xl bg-card p-4 shadow-card text-sm">
            <span className="money font-semibold text-primary">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      {sent ? (
        <section className="mt-10 rounded-2xl bg-card p-6 shadow-card" role="status">
          <h2 className="text-lg">Inscrição recebida</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vamos analisar e responder pelo e-mail ou WhatsApp informado. Depois da aprovação, entre no app com uma conta{" "}
            <strong>neste mesmo e-mail</strong> e abra Perfil → Programa de parceiros para ver seu link e suas comissões.
          </p>
        </section>
      ) : (
        <form className="mt-10 space-y-4" onSubmit={submit}>
          <h2 className="text-lg">Quero ser parceiro</h2>
          <Field id="name" label="Nome" required autoComplete="name" maxLength={120} value={form.name} onChange={set("name")} />
          <Field id="email" label="E-mail" type="email" required autoComplete="email" maxLength={254} value={form.email} onChange={set("email")} />
          <Field id="whatsapp" label="WhatsApp" type="tel" autoComplete="tel" maxLength={30} value={form.whatsapp} onChange={set("whatsapp")} />
          <Field id="instagram" label="Instagram ou outra rede" placeholder="@seuperfil" maxLength={100} value={form.instagram} onChange={set("instagram")} />
          <Field id="pix" label="Chave Pix para receber" maxLength={140} value={form.pixKey} onChange={set("pixKey")} />
          <div className="space-y-1.5">
            <label htmlFor="message" className="text-sm font-semibold">
              Como pretende divulgar?
            </label>
            <Textarea id="message" maxLength={1000} rows={4} value={form.message} onChange={set("message")} />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
            <span>
              Concordo que a equipe use estes dados só para analisar a inscrição, falar comigo e pagar as comissões, conforme a{" "}
              <Link to="/privacidade" className="font-semibold text-primary">
                política de privacidade
              </Link>
              .
            </span>
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Enviando…" : "Enviar inscrição"}
          </Button>
        </form>
      )}
    </main>
  );
}
