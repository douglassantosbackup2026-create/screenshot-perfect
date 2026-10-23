import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, passwordProblems, safePath } from "@/lib/auth/password";

export const Route = createFileRoute("/cadastro")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Criar conta — Previdência Intelligence" },
      { name: "description", content: "Crie sua conta com e-mail e senha e comece seu plano em 21 dias." },
      { property: "og:title", content: "Criar conta — Previdência Intelligence" },
      { property: "og:description", content: "Crie sua conta e comece seu plano de aposentadoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignUp,
});

function SignUp() {
  const { redirect: target } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const problems = passwordProblems(password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problems.length) return toast.error(problems[0]);
    if (password !== confirm) return toast.error("As senhas não são iguais.");
    if (!terms) return toast.error("Aceite os termos para continuar.");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setBusy(false);
    if (error) return toast.error(authErrorMessage(error.message));
    if (!data.session) {
      return toast.error("Conta criada, mas a confirmação de e-mail está ligada. Desligue-a no Supabase ou confirme pelo e-mail.");
    }
    toast.success("Conta criada!");
    navigate({ to: safePath(target, "/onboarding"), replace: true });
  }

  return (
    <AuthShell title="Criar conta" subtitle="Leva menos de um minuto.">
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Field id="name" label="Seu nome" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Field id="email" label="E-mail" type="email" required autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label="Senha" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letra e número.</p>
        <Field id="confirm" label="Confirmar senha" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
          <span>
            Li e aceito os <Link to="/sobre" className="font-semibold text-primary">termos de uso</Link> e a{" "}
            <Link to="/sobre" className="font-semibold text-primary">política de privacidade</Link>.
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</Button>
      </form>
      <p className="mt-6 text-center text-sm">
        Já tem conta? <Link to="/entrar" search={{ redirect: target }} className="font-semibold text-primary">Entrar</Link>
      </p>
    </AuthShell>
  );
}
