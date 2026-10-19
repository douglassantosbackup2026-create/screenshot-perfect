import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ComingSoon } from "@/components/PageShell";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Previdência Intelligence" },
      { name: "description", content: "Entre com link mágico por e-mail ou com sua conta Google." },
      { property: "og:title", content: "Entrar — Previdência Intelligence" },
      { property: "og:description", content: "Entre com link mágico por e-mail ou com sua conta Google." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageShell title="Entrar" intro="Use seu e-mail ou sua conta Google.">
      <ComingSoon text="Esta tela chega nas próximas etapas." />
    </PageShell>
  );
}
