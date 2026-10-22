import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/entrar")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Entrar — Previdência Intelligence" },
      { name: "description", content: "Entre com um link de acesso por e-mail ou com sua conta Google." },
      { property: "og:title", content: "Entrar — Previdência Intelligence" },
      { property: "og:description", content: "Entre com seu e-mail ou com o Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignIn,
});

/** Só aceita caminhos do próprio app. */
const safePath = (p?: string) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/hoje");

function SignIn() {
  const { redirect: target } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const go = () => navigate({ to: safePath(target), replace: true });
    void supabase.auth.getUser().then(({ data }) => data.user && go());
    const { data } = supabase.auth.onAuthStateChange((e) => e === "SIGNED_IN" && go());
    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  const back = `${window.location.origin}/entrar?redirect=${encodeURIComponent(safePath(target))}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: back } });
    setSending(false);
    if (error) toast.error("Não foi possível enviar o link. Confira o e-mail e tente de novo.");
    else setSent(true);
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back } });
    if (error) toast.error("O acesso com Google ainda não está disponível.");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-12 pt-8">
      <Link to="/" className="text-sm font-semibold text-primary">
        Previdência Intelligence
      </Link>
      <div className="flex flex-1 flex-col justify-center">
        <h1>Entrar</h1>
        {sent ? (
          <p className="mt-3" role="status">
            Enviamos um link para <strong>{email}</strong>. Abra o e-mail neste aparelho para entrar.
          </p>
        ) : (
          <>
            <p className="mt-3 text-muted-foreground">Entre com seu e-mail. Enviamos um link de acesso, sem senha.</p>
            <form className="mt-6 space-y-3" onSubmit={sendLink}>
              <label htmlFor="email" className="text-sm font-semibold">
                E-mail
              </label>
              <Input id="email" type="email" required placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? "Enviando…" : "Enviar link de acesso"}
              </Button>
            </form>
            <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google}>
              Continuar com Google
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
