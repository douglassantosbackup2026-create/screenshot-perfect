import { createFileRoute, Link } from "@tanstack/react-router";
import { ABOUT_TEXT } from "@/lib/labels";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Previdência Intelligence" },
      { name: "description", content: "Ferramenta de educação e planejamento de aposentadoria. Não somos banco, corretora nem consultoria." },
      { property: "og:title", content: "Sobre o Previdência Intelligence" },
      { property: "og:description", content: "Educação e planejamento de aposentadoria, sem vender produtos financeiros." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-8">
      <Link to="/" className="text-sm font-semibold text-primary">
        Voltar ao início
      </Link>
      <h1 className="mt-6">Sobre o app</h1>
      <p className="mt-4">{ABOUT_TEXT}</p>
      <h2 className="mt-10 text-lg">Termos de uso e privacidade</h2>
      <p className="mt-2 text-muted-foreground">
        Leia os{" "}
        <Link to="/termos" className="text-primary underline">
          termos de uso
        </Link>{" "}
        e a{" "}
        <Link to="/privacidade" className="text-primary underline">
          política de privacidade
        </Link>
        .
      </p>
    </main>
  );
}
