import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { openConsentPreferences } from "@/lib/analytics/analytics";

export const Route = createFileRoute("/privacidade")({
  head: () => pageHead("Privacidade", "Quais dados o app guarda, para quê, e como exportar ou apagar tudo.", "Quais dados o app guarda e como exportar ou apagar tudo."),
  component: Privacy,
});

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "O que guardamos",
    body: [
      "Sua conta: e-mail e senha (ou o login do Google). A senha fica com o serviço de autenticação; nós não a vemos.",
      "O que você informa no app: perfil, plano de aposentadoria, aportes, lançamentos, contas, orçamento, patrimônio, metas e preferências.",
      "Na calculadora, o e-mail só é guardado se você pedir para receber novidades e marcar o consentimento.",
    ],
  },
  {
    title: "Onde e para quê",
    body: [
      "Com conta, seus dados ficam no nosso banco de dados, ligados só à sua conta, para você usar o app em qualquer aparelho. Cada pessoa só tem acesso aos próprios dados.",
      "Sem conta, o que você testa fica apenas neste navegador.",
      "Usamos os dados para fazer as contas do app e mostrar sua evolução. Os cálculos são feitos com o que você informa; não acessamos sua conta bancária.",
    ],
  },
  {
    title: "Medição de uso (só se você aceitar)",
    body: [
      "Se você aceitar no aviso de privacidade, contamos etapas do uso: visitar a página inicial, usar a calculadora, deixar o e-mail, criar a conta, abrir o pagamento e assinar.",
      "Junto vão a página, a origem da visita (como utm_source de um anúncio) e um código aleatório deste navegador. Nunca vão valores, lançamentos ou o que você digita.",
      "Fica no nosso próprio banco, sem empresas de anúncio ou de métricas. Só a equipe do app vê os números, sempre somados.",
      "Se recusar, nada é medido e nenhum código é criado. Dá para mudar a escolha quando quiser em “Preferências de privacidade”, aqui embaixo ou no Perfil.",
    ],
  },
  {
    title: "Seus direitos",
    body: [
      "Exportar: em Perfil, “Baixar meus dados” gera um arquivo com tudo.",
      "Apagar: em Perfil, “Excluir minha conta” apaga sua conta e seus dados. Não dá para desfazer.",
      "Por padrão, os valores aparecem ocultos na tela até você pedir para ver.",
    ],
  },
];

function Privacy() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-8">
      <Link to="/" className="text-sm font-semibold text-primary">
        Voltar ao início
      </Link>
      <h1 className="mt-6">Privacidade</h1>
      <p className="mt-3 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-card">
        Versão preliminar, em linguagem simples. A política completa está em revisão jurídica antes do beta aberto.
      </p>
      {SECTIONS.map((s) => (
        <section key={s.title} className="mt-8">
          <h2 className="text-lg">{s.title}</h2>
          <ul className="mt-3 space-y-2">
            {s.body.map((b) => (
              <li key={b} className="text-muted-foreground">
                {b}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Button variant="outline" className="mt-8 w-full" onClick={openConsentPreferences}>
        Preferências de privacidade
      </Button>
    </main>
  );
}
