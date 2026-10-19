import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Previdência Intelligence" },
      { name: "description", content: "Entre com um link de acesso por e-mail ou com sua conta Google." },
      { property: "og:title", content: "Entrar — Previdência Intelligence" },
      { property: "og:description", content: "Entre com seu e-mail ou com o Google." },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const [email, setEmail] = useState("");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-12 pt-8">
      <Link to="/" className="text-sm font-semibold text-primary">
        Previdência Intelligence
      </Link>
      <div className="flex flex-1 flex-col justify-center">
        <h1>Entrar</h1>
        <p className="mt-3 text-muted-foreground">Entre com seu e-mail. Enviamos um link de acesso.</p>
        <form className="mt-6 space-y-3" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="email" className="text-sm font-semibold">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
          <Button type="submit" className="w-full" disabled title="Disponível na etapa de login">
            Enviar link de acesso
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full" disabled title="Disponível na etapa de login">
          Continuar com Google
        </Button>

        <div className="mt-10 rounded-2xl border border-dashed border-border p-4 text-sm">
          <p className="text-muted-foreground">O login ainda não está ativo. Enquanto isso, explore o app em modo demonstração.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/onboarding">Começar do zero</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/hoje">Ver com dados de exemplo</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
