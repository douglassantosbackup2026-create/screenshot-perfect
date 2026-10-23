import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, safePath } from "@/lib/auth/password";

export const Route = createFileRoute("/entrar")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Entrar — Previdência Intelligence" },
      { name: "description", content: "Entre com seu e-mail e senha ou com sua conta Google." },
      { property: "og:title", content: "Entrar — Previdência Intelligence" },
      { property: "og:description", content: "Entre com seu e-mail e senha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const { redirect: target } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: safePath(target), replace: true });
    });
  }, [navigate, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return toast.error(authErrorMessage(error.message));
    navigate({ to: safePath(target), replace: true });
  }

  async function google() {
    const back = `${window.location.origin}/entrar?redirect=${encodeURIComponent(safePath(target))}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back } });
    if (error) toast.error("O acesso com Google ainda não está disponível.");
  }

  return (
    <AuthShell title="Entrar" subtitle="Use seu e-mail e senha.">
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Field id="email" label="E-mail" type="email" required autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label="Senha" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="text-right text-sm">
          <Link to="/esqueci-senha" className="font-semibold text-primary">Esqueci minha senha</Link>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" className="w-full" onClick={google}>Continuar com Google</Button>
      <p className="mt-6 text-center text-sm">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" search={{ redirect: target }} className="font-semibold text-primary">Criar conta</Link>
      </p>
    </AuthShell>
  );
}
