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
    title: "Contagem anônima (para todos)",
    body: [
      "Somamos quantas visitas cada página pública recebe por dia e quantas simulações da calculadora são começadas e concluídas.",
      "É só um total por dia: não guardamos quem foi, nem IP, cookie, código do navegador ou o que foi digitado. Não dá para saber nada sobre você a partir disso.",
    ],
  },
  {
    title: "Medição de uso (só se você aceitar)",
    body: [
      "Se você aceitar no aviso de privacidade, contamos etapas do uso: visitar a página inicial, usar a calculadora, deixar o e-mail, criar a conta, abrir o pagamento e assinar, e quais áreas do app você abre.",
      "Junto vão a página, a origem da visita (como utm_source de um anúncio), um código aleatório deste navegador e um código da sessão (some ao fechar a aba). Da calculadora vão só faixas (por exemplo, “30–39 anos”), nunca os números que você digita. Nunca vão valores, lançamentos ou patrimônio.",
      "Fica no nosso próprio banco, sem empresas de anúncio ou de métricas. Só a equipe do app vê os números, sempre somados.",
      "Se recusar, nada disso é medido e nenhum código é criado (a contagem anônima acima continua). Dá para mudar a escolha quando quiser em “Preferências de privacidade”, aqui embaixo ou no Perfil.",
    ],
  },
  {
    title: "Atendimento e acesso da equipe",
    body: [
      "Mensagens enviadas pelo “Fale conosco” (Perfil) ou pela página de contato ficam guardadas com o seu e-mail para responder e acompanhar o pedido.",
      "A equipe acessa só o necessário para cada função (financeiro, suporte, marketing…). Ninguém da equipe vê seu patrimônio, seus lançamentos ou suas metas: os relatórios internos são números somados, e grupos com menos de 5 pessoas não aparecem.",
      "Toda consulta a uma conta e toda ação da equipe ficam registradas na auditoria.",
    ],
  },
  {
    title: "Por quanto tempo guardamos",
    body: [
      "Seus dados do app: enquanto a conta existir. Ao excluir a conta, apagamos tudo na hora, inclusive o e-mail deixado na calculadora.",
      "Medição de uso: 13 meses. E-mails da calculadora sem conta: 24 meses.",
      "Mensagens do WhatsApp: guardamos só o código de cada mensagem, por 90 dias, para não registrar a mesma duas vezes.",
      "Registros de segurança (pagamentos, mudanças de assinatura, ações da equipe): 5 anos, sem possibilidade de alteração, para auditoria e obrigações legais. O registro do seu consentimento fica enquanto a conta existir.",
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
