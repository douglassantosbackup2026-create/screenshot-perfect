import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ComingSoon } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/plano")({
  head: () => ({
    meta: [
      { title: "Plano — Previdência Intelligence" },
      { name: "description", content: "Seu plano de aposentadoria com três cenários e premissas visíveis." },
      { property: "og:title", content: "Plano — Previdência Intelligence" },
      { property: "og:description", content: "Seu plano de aposentadoria com três cenários e premissas visíveis." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageShell title="Seu plano" intro="Três cenários, em reais de hoje, com e sem INSS.">
      <ComingSoon text="Esta tela chega nas próximas etapas." />
    </PageShell>
  );
}
