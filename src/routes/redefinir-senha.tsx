import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { account, passwordProblem, PASSWORD_MIN, useSession } from "@/lib/data/session";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Nova senha — Previdência Intelligence" },
      { name: "description", content: "Crie uma nova senha para sua conta." },
    ],
  }),
  component: ResetPassword,
});

/** Aberta pelo link do e-mail de "esqueci a senha": o link já traz uma sessão temporária para trocar a senha. */
function ResetPassword() {
  const navigate = useNavigate();
  const { ready, session } = useSession();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const problem = password ? passwordProblem(password) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== repeat) {
      toast.error("As senhas não são iguais.");
      return;
    }
    setBusy(true);
    try {
      await account.updatePassword(password);
      toast.success("Senha alterada.");
      navigate({ to: "/hoje" });
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
        <h1>Nova senha</h1>
        {!ready ? (
          <p className="mt-3 text-muted-foreground">Conferindo o link…</p>
        ) : !session ? (
          <div className="mt-4 rounded-2xl bg-card p-5 text-sm shadow-card">
            <p>Este link expirou ou já foi usado.</p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/entrar">Pedir um novo link</Link>
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={submit}>
            <div>
              <label htmlFor="password" className="text-sm font-semibold">
                Nova senha
              </label>
              <Input id="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" />
              <p className={"mt-1.5 text-sm " + (problem ? "text-destructive" : "text-muted-foreground")}>{problem ?? `Pelo menos ${PASSWORD_MIN} caracteres, com letras e números.`}</p>
            </div>
            <div>
              <label htmlFor="repeat" className="text-sm font-semibold">
                Repita a senha
              </label>
              <Input id="repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} className="mt-1.5 h-11" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
