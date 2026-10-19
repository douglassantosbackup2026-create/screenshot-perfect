import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ComingSoon } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Previdência Intelligence" },
      { name: "description", content: "Nível, conquistas, lembretes e privacidade." },
      { property: "og:title", content: "Perfil — Previdência Intelligence" },
      { property: "og:description", content: "Nível, conquistas, lembretes e privacidade." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageShell title="Perfil" intro="Seu nível, conquistas e preferências.">
      <ComingSoon text="Esta tela chega nas próximas etapas." />
    </PageShell>
  );
}
