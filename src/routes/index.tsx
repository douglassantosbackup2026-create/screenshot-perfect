import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Previdência Intelligence — aposentadoria sem depender do INSS" },
      {
        name: "description",
        content:
          "Um plano de aposentadoria que não depende do governo — e que você consegue seguir. Programa de 21 dias, plano com premissas visíveis e diário de constância.",
      },
      { property: "og:title", content: "Previdência Intelligence" },
      {
        property: "og:description",
        content: "Um plano de aposentadoria que não depende do governo — e que você consegue seguir.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col justify-center px-5 py-16">
      <p className="text-sm font-semibold text-primary">Previdência Intelligence</p>
      <h1 className="mt-4 text-foreground">
        Um plano de aposentadoria que não depende do governo — e que você consegue seguir.
      </h1>
      <p className="mt-4 text-muted-foreground">
        Para quem trabalha como PJ ou autônomo. Pequenos passos, todo mês, sem sorte e sem
        promessas.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/calculadora"
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-primary px-5 font-semibold text-primary-foreground"
        >
          Calcular quanto falta
        </Link>
        <Link
          to="/entrar"
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-border bg-card px-5 font-semibold text-foreground"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
