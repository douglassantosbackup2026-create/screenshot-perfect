import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { loadAccess } from "@/lib/billing/access";

export const Route = createFileRoute("/pagamento")({
  head: () => ({
    meta: [
      { title: `Assinatura — ${APP_NAME}` },
      { name: "description", content: "Acompanhe a confirmação da sua assinatura." },
      { property: "og:title", content: `Assinatura — ${APP_NAME}` },
      { property: "og:description", content: "Confirmação da sua assinatura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Payment,
});

const POLL_MS = 3000;
const MAX_TRIES = 20; // cerca de 1 minuto; depois, a pessoa atualiza quando quiser

/**
 * Volta do Mercado Pago. Quem libera o acesso é o webhook, que pode levar alguns segundos:
 * a página consulta a assinatura até ela aparecer, em vez de confiar no que veio na URL.
 */
function Payment() {
  const [state, setState] = useState<"checking" | "active" | "pending" | "signed-out">("checking");
  const [round, setRound] = useState(0);

  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (stopped) return;
      if (!data.user) return setState("signed-out");
      const a = await loadAccess(data.user.id);
      if (stopped) return;
      if (a.active) return setState("active");
      tries += 1;
      if (tries >= MAX_TRIES) return setState("pending");
      timer = setTimeout(check, POLL_MS);
    }
    setState("checking");
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [round]);

  const [title, text] = {
    checking: ["Confirmando sua assinatura…", "Estamos esperando a confirmação do Mercado Pago. Leva alguns segundos."],
    active: ["Assinatura confirmada", `Pronto. O ${APP_NAME} está liberado para você.`],
    pending: [
      "Ainda aguardando a confirmação",
      "O Mercado Pago ainda não confirmou o cartão. Se você concluiu a assinatura, atualize em alguns minutos. Se não concluiu, nada foi cobrado.",
    ],
    "signed-out": ["Entre na sua conta", "Entre com a conta usada na assinatura para continuar."],
  }[state];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col justify-center px-5">
      <h1>{title}</h1>
      <p className="mt-3 text-muted-foreground" aria-live="polite">
        {text}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {state === "active" && (
          // O guard leva ao onboarding quem ainda não fez.
          <Button asChild>
            <Link to="/hoje">Continuar</Link>
          </Button>
        )}
        {state === "pending" && <Button onClick={() => setRound((r) => r + 1)}>Atualizar</Button>}
        {state === "signed-out" && (
          <Button asChild>
            <Link to="/entrar" search={{ redirect: "/pagamento" }}>
              Entrar
            </Link>
          </Button>
        )}
        {state !== "active" && (
          <Button asChild variant="outline">
            <Link to="/planos">Ver assinatura</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
