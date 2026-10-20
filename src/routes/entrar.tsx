import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demo } from "@/lib/data/demo-store";
import { account, setDemoMode, useSession } from "@/lib/data/session";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): { confirmado?: boolean } => (s["confirmado"] ? { confirmado: true } : {}),
  head: () => ({
    meta: [
      { title: "Entrar — Previdência Intelligence" },
      { name: "description", content: "Entre com seu e-mail e senha para ver seu plano, seu orçamento e sua evolução." },
      { property: "og:title", content: "Entrar — Previdência Intelligence" },
      { property: "og:description", content: "Entre com seu e-mail e senha." },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { confirmado } = Route.useSearch();
  const { session } = useSession();
  const [mode, setMode] = useState<"entrar" | "esqueci">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Já logado (ou acabou de confirmar o e-mail e a sessão veio no link): vai direto para o app.
  useEffect(() => {
    if (session) navigate({ to: "/hoje", replace: true });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "entrar") {
        await account.signIn(email, password);
        track("login");
        navigate({ to: "/hoje" });
      } else {
        await account.requestPasswordReset(email);
        setResetSent(true);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function tryDemo() {
    setDemoMode(true);
    demo.reset();
    navigate({ to: "/hoje" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-12 pt-8">
      <Link to="/" className="text-sm font-semibold text-primary">
        Previdência Intelligence
      </Link>
      <div className="flex flex-1 flex-col justify-center">
        <h1>{mode === "entrar" ? "Entrar" : "Esqueci minha senha"}</h1>
        {confirmado && mode === "entrar" && (
          <p className="mt-3 rounded-xl bg-primary/15 p-3 text-sm text-primary">E-mail confirmado. Agora é só entrar.</p>
        )}
        <p className="mt-3 text-muted-foreground">
          {mode === "entrar" ? "Use o e-mail e a senha da sua conta." : "Informe seu e-mail. Enviamos um link para você criar uma senha nova."}
        </p>

        {resetSent ? (
          <div className="mt-6 rounded-2xl bg-card p-5 text-sm shadow-card">
            <p className="font-semibold">Confira seu e-mail</p>
            <p className="mt-1 text-muted-foreground">
              Se existir uma conta com {email.trim()}, chega em instantes um link para criar a nova senha. Veja também o spam.
            </p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => (setMode("entrar"), setResetSent(false))}>
              Voltar para entrar
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={submit}>
            <div>
              <label htmlFor="email" className="text-sm font-semibold">
                E-mail
              </label>
              <Input id="email" type="email" autoComplete="email" required placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11" />
            </div>
            {mode === "entrar" && (
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="password" className="text-sm font-semibold">
                    Senha
                  </label>
                  <button type="button" className="text-sm text-primary hover:underline" onClick={() => setMode("esqueci")}>
                    Esqueci a senha
                  </button>
                </div>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Enviar link para nova senha"}
            </Button>
            {mode === "esqueci" && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("entrar")}>
                Voltar
              </Button>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-semibold text-primary hover:underline">
            Criar conta grátis
          </Link>
        </p>
        <div className="mt-10 rounded-2xl border border-dashed border-border p-4 text-sm">
          <p className="text-muted-foreground">Quer só conhecer? Explore com dados de exemplo, sem criar conta. Fica salvo só neste aparelho.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={tryDemo}>
            Experimentar sem conta
          </Button>
        </div>
      </div>
    </main>
  );
}
