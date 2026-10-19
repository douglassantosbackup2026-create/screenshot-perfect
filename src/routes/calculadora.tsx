import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ComingSoon } from "@/components/PageShell";

export const Route = createFileRoute("/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadora — Previdência Intelligence" },
      { name: "description", content: "Descubra quanto falta para se aposentar sem depender do INSS, sem precisar de login." },
      { property: "og:title", content: "Calculadora — Previdência Intelligence" },
      { property: "og:description", content: "Descubra quanto falta para se aposentar sem depender do INSS, sem precisar de login." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageShell title="Quanto falta para me aposentar sem o INSS" intro="Simule em reais de hoje, com as premissas à vista.">
      <ComingSoon text="Esta tela chega nas próximas etapas." />
    </PageShell>
  );
}
