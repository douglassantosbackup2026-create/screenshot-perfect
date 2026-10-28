import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/seo";

export const Route = createFileRoute("/pagamento")({
  validateSearch: z.object({ status: z.string().optional(), collection_status: z.string().optional() }),
  head: () => ({
    meta: [
      { title: `Pagamento — ${APP_NAME}` },
      { name: "description", content: "Acompanhe a confirmação do pagamento do seu plano." },
      { property: "og:title", content: `Pagamento — ${APP_NAME}` },
      { property: "og:description", content: "Confirmação do pagamento do seu plano." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Payment,
});

function Payment() {
  const s = Route.useSearch();
  const status = s.collection_status ?? s.status;
  const [title, text] =
    status === "approved"
      ? ["Pagamento confirmado", "Seu plano já está liberado. Os recursos pagos aparecem no app a partir de agora."]
      : status === "pending" || status === "in_process"
        ? ["Aguardando confirmação", "Pix e boleto podem levar alguns minutos ou até 3 dias úteis. Liberamos assim que o Mercado Pago confirmar."]
        : ["Pagamento não concluído", "Nada foi cobrado. Você pode tentar de novo quando quiser."];
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col justify-center px-5">
      <h1>{title}</h1>
      <p className="mt-3 text-muted-foreground">{text}</p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link to="/hoje">Ir para o app</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}
