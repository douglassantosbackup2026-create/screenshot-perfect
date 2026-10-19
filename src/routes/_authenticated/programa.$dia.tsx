import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ComingSoon } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/programa/$dia")({
  head: () => ({
    meta: [
      { title: "Lição do dia — Previdência Intelligence" },
      { name: "description", content: "Uma lição de 3 a 5 minutos do programa de 21 dias." },
      { property: "og:title", content: "Lição do dia — Previdência Intelligence" },
      { property: "og:description", content: "Uma lição de 3 a 5 minutos do programa de 21 dias." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageShell title="Lição do dia" intro="Uma lição curta e três perguntas.">
      <ComingSoon text="Esta tela chega nas próximas etapas." />
    </PageShell>
  );
}
