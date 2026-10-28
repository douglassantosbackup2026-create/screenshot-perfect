// Os três apps que o Mitikos junta. Mesmo texto na landing e no onboarding.
// `where` diz onde cada um fica no menu (src/components/nav/areas.tsx).

export type Pillar = {
  key: "orcamento" | "patrimonio" | "aposentadoria";
  title: string;
  /** O app que este pilar substitui. */
  replaces: string;
  text: string;
  where: string;
};

export const PILLARS: Pillar[] = [
  {
    key: "orcamento",
    title: "Orçamento",
    replaces: "No lugar do app de controle de gastos",
    text: "Lançamentos, contas e cartão, orçamento por envelope e o fechamento do mês.",
    where: "Dinheiro",
  },
  {
    key: "patrimonio",
    title: "Patrimônio",
    replaces: "No lugar da planilha de investimentos",
    text: "Tudo o que você tem e deve num lugar só, com a evolução mês a mês.",
    where: "Futuro › Patrimônio",
  },
  {
    key: "aposentadoria",
    title: "Aposentadoria",
    replaces: "No lugar do simulador de aposentadoria",
    text: "Quanto guardar por mês para parar de trabalhar, em três cenários, sem depender do INSS.",
    where: "Futuro › Plano",
  },
];
