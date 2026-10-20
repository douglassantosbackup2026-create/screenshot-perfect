import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { SIMULATION_FOOTER } from "@/lib/labels";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Previdência Intelligence" },
      { name: "description", content: "As regras de uso do Previdência Intelligence: o que o app faz, o que não faz e as responsabilidades de cada parte." },
      { property: "og:title", content: "Termos de uso — Previdência Intelligence" },
      { property: "og:description", content: "O que o app faz, o que não faz e as responsabilidades de cada parte." },
    ],
    links: [{ rel: "canonical", href: "/termos" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage
      title="Termos de uso"
      intro="Ao criar uma conta ou usar o Previdência Intelligence, você concorda com estes termos. Eles são curtos de propósito: leia antes de começar."
    >
      <section>
        <h2>1. O que é o app</h2>
        <p>Uma ferramenta de educação e planejamento financeiro pessoal: simulações de aposentadoria, organização de gastos, orçamento e acompanhamento de patrimônio.</p>
      </section>
      <section>
        <h2>2. O que o app não é</h2>
        <ul>
          <li>Não é banco, corretora, seguradora nem consultoria de investimentos.</li>
          <li>Não faz recomendação individual de investimento nem vende produtos financeiros.</li>
          <li>Não movimenta dinheiro e não acessa sua conta bancária.</li>
        </ul>
        <p>{SIMULATION_FOOTER}</p>
      </section>
      <section>
        <h2>3. Sua conta</h2>
        <ul>
          <li>Você precisa ter 18 anos ou mais e informar um e-mail que seja seu.</li>
          <li>Mantenha sua senha em segredo; o que for feito com ela é responsabilidade da conta.</li>
          <li>Os números que você informa são seus: o app calcula a partir deles e não confere com instituições.</li>
        </ul>
      </section>
      <section>
        <h2>4. Uso aceitável</h2>
        <p>Não tente acessar dados de outras pessoas, sobrecarregar o serviço ou usá-lo para algo ilegal. Podemos suspender contas que façam isso.</p>
      </section>
      <section>
        <h2>5. Planos pagos</h2>
        <p>Algumas funções podem fazer parte de um plano pago. Preço, período e o que está incluído aparecem antes do pagamento. Você cancela quando quiser e mantém acesso até o fim do período já pago. Seus dados nunca ficam presos: você sempre pode ver e exportar o que registrou.</p>
      </section>
      <section>
        <h2>6. Disponibilidade e responsabilidade</h2>
        <p>Trabalhamos para o app estar sempre no ar e correto, mas ele é oferecido como está. Decisões financeiras são suas; não respondemos por perdas decorrentes de decisões tomadas com base nas simulações.</p>
      </section>
      <section>
        <h2>7. Privacidade</h2>
        <p>
          O tratamento dos seus dados segue a <Link to="/privacidade" className="text-primary underline">política de privacidade</Link>.
        </p>
      </section>
      <section>
        <h2>8. Encerramento e mudanças</h2>
        <p>Você pode excluir sua conta a qualquer momento no Perfil. Se estes termos mudarem de forma relevante, avisaremos no app antes de a mudança valer. Vale a lei brasileira.</p>
      </section>
    </LegalPage>
  );
}
