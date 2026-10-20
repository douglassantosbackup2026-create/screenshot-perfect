import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Previdência Intelligence" },
      { name: "description", content: "Quais dados o Previdência Intelligence coleta, para quê, por quanto tempo e como você exporta ou exclui tudo (LGPD)." },
      { property: "og:title", content: "Política de privacidade — Previdência Intelligence" },
      { property: "og:description", content: "Quais dados coletamos, para quê e como exportar ou excluir tudo." },
    ],
    links: [{ rel: "canonical", href: "/privacidade" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage
      title="Política de privacidade"
      intro="Seus dados financeiros são seus. Esta política explica, em linguagem direta, o que guardamos, para quê, com quem compartilhamos e como você exporta ou apaga tudo, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018)."
    >
      <section>
        <h2>1. Quais dados guardamos</h2>
        <ul>
          <li>Conta: nome, e-mail e senha (a senha fica cifrada; ninguém da equipe consegue lê-la).</li>
          <li>Plano e perfil: idade, idade para se aposentar, renda desejada, patrimônio, aportes e as respostas que você escolher dar.</li>
          <li>Finanças que você informa ou importa: contas, lançamentos, orçamento, investimentos e metas.</li>
          <li>Progresso na jornada: lições, respostas, missões, XP e conquistas.</li>
          <li>Se você deixar seu e-mail na calculadora, guardamos o e-mail e a simulação para enviar o resultado.</li>
          <li>Dados de uso anônimos, só se você permitir (veja o item 4).</li>
        </ul>
        <p>Não pedimos senhas de banco, não movimentamos dinheiro e não acessamos sua conta bancária. Extratos importados são lidos no seu aparelho; só os lançamentos vão para a sua conta no app.</p>
      </section>
      <section>
        <h2>2. Para que usamos</h2>
        <ul>
          <li>Mostrar seu plano, seu orçamento e sua evolução (execução do serviço que você pediu).</li>
          <li>Enviar os lembretes que você ligou e o resultado da calculadora (consentimento, que você pode retirar a qualquer momento).</li>
          <li>Segurança da conta e prevenção de fraude (legítimo interesse).</li>
        </ul>
        <p>Não vendemos seus dados, não fazemos perfil para publicidade de terceiros e não recomendamos produtos financeiros.</p>
      </section>
      <section>
        <h2>3. Com quem compartilhamos</h2>
        <p>Só com os fornecedores que fazem o app funcionar, sob contrato e apenas para essa finalidade: hospedagem e banco de dados (Supabase), envio de e-mail e, se você permitir, medição de uso. Também cumprimos ordens legais de autoridades competentes.</p>
      </section>
      <section>
        <h2>4. Dados de uso anônimos</h2>
        <p>
          Com a sua permissão, registramos eventos como “concluiu o onboarding” ou “importou um extrato”, para entender onde o app ajuda e onde atrapalha.
          Esses eventos nunca incluem valores, nomes ou e-mails. Você muda a permissão quando quiser em Perfil, em “Permitir dados de uso anônimos”.
        </p>
      </section>
      <section>
        <h2>5. Por quanto tempo</h2>
        <p>Enquanto sua conta existir. Ao excluir a conta, apagamos seus dados do banco na hora; cópias de segurança são sobrescritas em até 30 dias.</p>
      </section>
      <section>
        <h2>6. Seus direitos</h2>
        <ul>
          <li>Ver e baixar todos os seus dados: Perfil → “Baixar meus dados”.</li>
          <li>Corrigir: edite direto no app.</li>
          <li>Excluir tudo: Perfil → “Excluir minha conta”.</li>
          <li>Retirar consentimentos: desligue lembretes e dados de uso no Perfil.</li>
          <li>Tirar dúvidas ou fazer uma solicitação: escreva para o canal de contato informado em <Link to="/sobre" className="text-primary underline">Sobre o app</Link>.</li>
        </ul>
      </section>
      <section>
        <h2>7. Segurança</h2>
        <p>Conexão cifrada, senhas cifradas e regras no banco que só deixam cada pessoa ler os próprios dados. Nenhum sistema é infalível; se houver um incidente que afete você, avisaremos.</p>
      </section>
      <section>
        <h2>8. Mudanças</h2>
        <p>Se esta política mudar de forma relevante, avisaremos no app antes de a mudança valer.</p>
      </section>
    </LegalPage>
  );
}
