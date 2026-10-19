import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ComingSoon } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Começar — Previdência Intelligence" },
      { name: "description", content: "Conte um pouco sobre você para montar seu plano." },
      { property: "og:title", content: "Começar — Previdência Intelligence" },
      { property: "og:description", content: "Conte um pouco sobre você para montar seu plano." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageShell title="Vamos começar" intro="Algumas perguntas rápidas, uma por tela.">
      <ComingSoon text="Esta tela chega nas próximas etapas." />
    </PageShell>
  );
}
