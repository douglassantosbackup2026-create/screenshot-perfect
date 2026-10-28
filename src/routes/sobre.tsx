import { createFileRoute, Link } from "@tanstack/react-router";
import { ABOUT_TEXT } from "@/lib/labels";
import { APP_NAME } from "@/lib/seo";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: `Sobre — ${APP_NAME}` },
      { name: "description", content: "Ferramenta de educação e planejamento de aposentadoria. Não somos banco, corretora nem consultoria." },
      { property: "og:title", content: `Sobre o ${APP_NAME}` },
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
        Os termos de uso e a política de privacidade estão em redação e serão revisados por um advogado antes do beta aberto.
      </p>
    </main>
  );
}
