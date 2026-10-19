import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ComingSoon } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/diario")({
  head: () => ({
    meta: [
      { title: "Diário — Previdência Intelligence" },
      { name: "description", content: "O fio da constância: seus registros mensais de aporte." },
      { property: "og:title", content: "Diário — Previdência Intelligence" },
      { property: "og:description", content: "O fio da constância: seus registros mensais de aporte." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageShell title="Diário" intro="Seu fio começa no primeiro aporte registrado.">
      <ComingSoon text="Esta tela chega nas próximas etapas." />
    </PageShell>
  );
}
