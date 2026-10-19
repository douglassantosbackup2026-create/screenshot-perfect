import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ComingSoon } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/admin/conteudo")({
  head: () => ({
    meta: [
      { title: "Conteúdo — Previdência Intelligence" },
      { name: "description", content: "Cadastro e revisão de lições, perguntas e missões." },
      { property: "og:title", content: "Conteúdo — Previdência Intelligence" },
      { property: "og:description", content: "Cadastro e revisão de lições, perguntas e missões." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageShell title="Conteúdo" intro="Lições, perguntas e missões.">
      <ComingSoon text="Esta tela chega nas próximas etapas." />
    </PageShell>
  );
}
