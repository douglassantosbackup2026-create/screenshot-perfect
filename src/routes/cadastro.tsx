import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { account, passwordProblem, PASSWORD_MIN } from "@/lib/data/session";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Previdência Intelligence" },
      { name: "description", content: "Crie sua conta grátis com e-mail e senha e salve seu plano de aposentadoria." },
      { property: "og:title", content: "Criar conta — Previdência Intelligence" },
      { property: "og:description", content: "Crie sua conta grátis com e-mail e senha." },
    ],
  }),
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const problem = password ? passwordProblem(password) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== repeat) {
      toast.error("As senhas não são iguais.");
      return;
    }
    if (!terms) {
      toast.error("Para criar a conta, aceite os termos e a política de privacidade.");
      return;
    }
    setBusy(true);
    try {
      const r = await account.signUp(email, password, name);
      if (r.needsConfirmation) setSentTo(email.trim());
      else navigate({ to: "/onboarding" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-12 pt-8">
      <Link to="/" className="text-sm font-semibold text-primary">
        Previdência Intelligence
      </Link>
      <div className="flex flex-1 flex-col justify-center">
        {sentTo ? (
          <section className="rounded-2xl bg-card p-6 shadow-card" aria-live="polite">
            <h1 className="text-2xl">Confirme seu e-mail</h1>
            <p className="mt-3 text-muted-foreground">
              Enviamos um link de confirmação para <strong className="text-foreground">{sentTo}</strong>. Abra o e-mail, confirme e depois entre com sua
              senha. Veja também o spam.
            </p>
            <Button asChild className="mt-5 w-full">
              <Link to="/entrar">Já confirmei, quero entrar</Link>
            </Button>
          </section>
        ) : (
          <>
            <h1>Criar conta</h1>
            <p className="mt-3 text-muted-foreground">Grátis. Seu plano, seu orçamento e sua evolução ficam salvos com segurança.</p>
            <form className="mt-6 space-y-3" onSubmit={submit}>
              <div>
                <label htmlFor="name" className="text-sm font-semibold">
                  Como quer ser chamado
                </label>
                <Input id="name" autoComplete="given-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11" />
              </div>
              <div>
                <label htmlFor="email" className="text-sm font-semibold">
                  E-mail
                </label>
                <Input id="email" type="email" autoComplete="email" required placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11" />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-semibold">
                  Senha
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="password-hint"
                  className="mt-1.5 h-11"
                />
                <p id="password-hint" className={"mt-1.5 text-sm " + (problem ? "text-destructive" : "text-muted-foreground")}>
                  {problem ?? `Pelo menos ${PASSWORD_MIN} caracteres, com letras e números.`}
                </p>
              </div>
              <div>
                <label htmlFor="repeat" className="text-sm font-semibold">
                  Repita a senha
                </label>
                <Input id="repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} className="mt-1.5 h-11" />
              </div>
              <label className="flex items-start gap-3 py-1 text-sm">
                <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
                <span className="text-muted-foreground">
                  Li e aceito os{" "}
                  <Link to="/sobre" className="text-primary underline">
                    termos de uso e a política de privacidade
                  </Link>
                  .
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Criando…" : "Criar conta"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/entrar" className="font-semibold text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
