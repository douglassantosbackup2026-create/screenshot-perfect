import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ComingSoon } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — Previdência Intelligence" },
      { name: "description", content: "Sua lição, sua missão e sua sequência da semana." },
      { property: "og:title", content: "Hoje — Previdência Intelligence" },
      { property: "og:description", content: "Sua lição, sua missão e sua sequência da semana." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageShell title="Hoje" intro="Sua lição do dia e a missão da semana aparecem aqui.">
      <ComingSoon text="Esta tela chega nas próximas etapas." />
    </PageShell>
  );
}
