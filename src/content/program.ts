// Conteúdo do programa de 21 dias (spec §10). STATUS: RASCUNHO — precisa de revisão profissional.
export type LessonOption = { id: string; text: string };
export type LessonQuestion = { prompt: string; options: LessonOption[]; correct: string; explanation: string };
export type ActionKey = "set_goal" | "create_plan" | "first_contribution";
export type Lesson = {
  day: number;
  title: string;
  objective: string;
  keyPoints: string[];
  questions: LessonQuestion[];
  sources: { label: string; url: string }[];
  actionKey: ActionKey | null;
  actionText: string | null;
};
export const PROGRAM = { slug: "plano-sem-inss-21", title: "Meu plano sem depender do INSS", totalDays: 21 } as const;
export const LESSONS: Lesson[] = [
 {
  "day": 1,
  "title": "O tempo trabalha para quem começa cedo",
  "objective": "entender que o tempo pesa mais do que o valor do primeiro aporte.",
  "keyPoints": [
   "Quem guarda R$ 500 por mês durante 30 anos, com retorno real de 4% ao ano, chega a cerca de R$ 343 mil em valores de hoje, tendo aportado R$ 180 mil.",
   "Em 20 anos, com o mesmo aporte, chega a cerca de R$ 182 mil (aportou R$ 120 mil). Dez anos a menos quase cortam o resultado pela metade.",
   "O app mostra tudo em \"reais de hoje\": já descontada a inflação.",
   "São simulações com premissas, não promessas de retorno."
  ],
  "questions": [
   {
    "prompt": "O que mais pesa no resultado de longo prazo?",
    "options": [
     {
      "id": "a",
      "text": "O valor do primeiro aporte"
     },
     {
      "id": "b",
      "text": "O tempo que o dinheiro fica aplicado"
     },
     {
      "id": "c",
      "text": "O dia do mês em que você aporta"
     }
    ],
    "correct": "b",
    "explanation": "Com juros compostos, cada ano a mais rende sobre tudo o que já foi acumulado."
   },
   {
    "prompt": "No exemplo de 30 anos, quanto dos R$ 343 mil veio dos seus aportes?",
    "options": [
     {
      "id": "a",
      "text": "Tudo"
     },
     {
      "id": "b",
      "text": "R$ 180 mil"
     },
     {
      "id": "c",
      "text": "Nada"
     }
    ],
    "correct": "b",
    "explanation": "O restante, cerca de R$ 163 mil, veio dos rendimentos."
   },
   {
    "prompt": "Os números do exemplo são:",
    "options": [
     {
      "id": "a",
      "text": "Uma garantia de retorno"
     },
     {
      "id": "b",
      "text": "Uma simulação com premissas"
     },
     {
      "id": "c",
      "text": "A média oficial do mercado"
     }
    ],
    "correct": "b",
    "explanation": "Toda projeção depende das premissas escolhidas e pode não se realizar."
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 2,
  "title": "A inflação encolhe o dinheiro em silêncio",
  "objective": "entender poder de compra e por que o app usa reais de hoje.",
  "keyPoints": [
   "Com inflação de 4% ao ano, os preços dobram em cerca de 18 anos.",
   "R$ 1.000 guardados embaixo do colchão compram, em 18 anos, o que hoje custa cerca de R$ 494.",
   "Por isso o plano fala em \"reais de hoje\": R$ 8.000 no plano significam o poder de compra de R$ 8.000 agora.",
   "Retorno real é o que sobra acima da inflação."
  ],
  "questions": [
   {
    "prompt": "Com inflação de 4% ao ano, em quanto tempo os preços dobram, aproximadamente?",
    "options": [
     {
      "id": "a",
      "text": "8 anos"
     },
     {
      "id": "b",
      "text": "18 anos"
     },
     {
      "id": "c",
      "text": "40 anos"
     }
    ],
    "correct": "b",
    "explanation": "Pela regra dos 72: 72 ÷ 4 = 18."
   },
   {
    "prompt": "\"Reais de hoje\" significa:",
    "options": [
     {
      "id": "a",
      "text": "Valores com o poder de compra atual"
     },
     {
      "id": "b",
      "text": "Valores sem juros"
     },
     {
      "id": "c",
      "text": "Valores em dólar"
     }
    ],
    "correct": "a",
    "explanation": "É a forma de comparar o futuro com a sua realidade de agora."
   },
   {
    "prompt": "Um investimento rendeu 4% num ano em que a inflação foi de 4%. O retorno real foi de:",
    "options": [
     {
      "id": "a",
      "text": "4%"
     },
     {
      "id": "b",
      "text": "8%"
     },
     {
      "id": "c",
      "text": "Cerca de 0%"
     }
    ],
    "correct": "c",
    "explanation": "O dinheiro cresceu, mas comprou o mesmo que antes."
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 3,
  "title": "Juros compostos, o motor do plano",
  "objective": "entender juros sobre juros e a regra dos 72.",
  "keyPoints": [
   "Juros compostos rendem sobre o valor inicial e sobre os rendimentos anteriores.",
   "Regra dos 72: divida 72 pela taxa anual para saber em quantos anos o dinheiro dobra, aproximadamente.",
   "A 4% reais ao ano, o dinheiro dobra em cerca de 18 anos; a 6%, em cerca de 12.",
   "O que acelera o efeito: tempo e constância. O que atrapalha: resgates e trocas frequentes."
  ],
  "questions": [
   {
    "prompt": "Juros compostos são:",
    "options": [
     {
      "id": "a",
      "text": "Juros calculados só sobre o valor inicial"
     },
     {
      "id": "b",
      "text": "Juros que também rendem sobre os juros anteriores"
     },
     {
      "id": "c",
      "text": "Juros cobrados por bancos"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "A 6% ao ano, o dinheiro dobra em cerca de:",
    "options": [
     {
      "id": "a",
      "text": "6 anos"
     },
     {
      "id": "b",
      "text": "12 anos"
     },
     {
      "id": "c",
      "text": "72 anos"
     }
    ],
    "correct": "b",
    "explanation": "72 ÷ 6 = 12."
   },
   {
    "prompt": "O que mais ajuda os juros compostos?",
    "options": [
     {
      "id": "a",
      "text": "Tempo e constância"
     },
     {
      "id": "b",
      "text": "Mudar de aplicação todo mês"
     },
     {
      "id": "c",
      "text": "Resgatar os rendimentos"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 4,
  "title": "Quanto custa a vida que você quer",
  "objective": "chegar a uma renda mensal desejada realista.",
  "keyPoints": [
   "Pense em reais de hoje: quanto você precisaria por mês para viver como gostaria.",
   "Comece pelas despesas atuais. Algumas tendem a subir (saúde), outras a cair (deslocamento para o trabalho).",
   "Um ponto de partida comum é a sua renda atual. Dá para ajustar depois.",
   "Um número aproximado agora vale mais que um número perfeito nunca."
  ],
  "questions": [
   {
    "prompt": "Em que valor você deve pensar a renda desejada?",
    "options": [
     {
      "id": "a",
      "text": "Em reais de hoje"
     },
     {
      "id": "b",
      "text": "Em reais do ano em que vai se aposentar"
     },
     {
      "id": "c",
      "text": "Em dólares"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Qual despesa costuma subir na aposentadoria?",
    "options": [
     {
      "id": "a",
      "text": "Saúde"
     },
     {
      "id": "b",
      "text": "Transporte para o trabalho"
     },
     {
      "id": "c",
      "text": "Material escolar"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "A renda desejada pode mudar depois?",
    "options": [
     {
      "id": "a",
      "text": "Não, é definitiva"
     },
     {
      "id": "b",
      "text": "Sim, o plano é revisado"
     },
     {
      "id": "c",
      "text": "Só a cada dez anos"
     }
    ],
    "correct": "b",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": "anotar a renda mensal desejada."
 },
 {
  "day": 5,
  "title": "O que o INSS cobre e por que planejamos sem ele",
  "objective": "entender os limites do INSS e a escolha de planejar sem depender dele.",
  "keyPoints": [
   "Em 2026, o maior benefício pago pelo INSS é R$ 8.475,55 e o menor é um salário mínimo, R$ 1.621,00.",
   "O valor que você recebe depende de quanto e por quanto tempo contribuiu. Quem contribui pouco tende a receber perto do mínimo.",
   "O MEI contribui com 5% do salário mínimo e, em regra, tem direito à aposentadoria por idade no valor de um salário mínimo. O contribuinte individual pode pagar 20% sobre o que declara (entre o mínimo e o teto) ou 11% sobre o mínimo, no plano simplificado.",
   "Este app planeja sem o INSS por padrão. Se você tiver uma estimativa do Meu INSS, pode informá-la e ver os dois cenários."
  ],
  "questions": [
   {
    "prompt": "Qual é o maior benefício pago pelo INSS em 2026?",
    "options": [
     {
      "id": "a",
      "text": "R$ 1.621,00"
     },
     {
      "id": "b",
      "text": "R$ 8.475,55"
     },
     {
      "id": "c",
      "text": "Não existe limite"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "Por que o app planeja sem o INSS por padrão?",
    "options": [
     {
      "id": "a",
      "text": "Porque o INSS não paga nada"
     },
     {
      "id": "b",
      "text": "Para o plano funcionar mesmo que o benefício seja menor do que você espera"
     },
     {
      "id": "c",
      "text": "Porque é proibido considerar o INSS"
     }
    ],
    "correct": "b",
    "explanation": "O INSS entra como cenário extra, nunca como base."
   },
   {
    "prompt": "Onde consultar sua estimativa oficial?",
    "options": [
     {
      "id": "a",
      "text": "No Meu INSS"
     },
     {
      "id": "b",
      "text": "Em redes sociais"
     },
     {
      "id": "c",
      "text": "No app do seu banco"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [
   {
    "label": "Teto do INSS 2026 (meutudo)",
    "url": "https://meutudo.com.br/blog/noticias/2026/01/12/teto-do-inss-em-2026-e-de-r-8-47555-confira-faixas-e-aliquotas/"
   },
   {
    "label": "Alíquotas por categoria (Barbieri Advogados)",
    "url": "https://www.barbieriadvogados.com/teto-do-inss-2026-valor-tabela-historica/"
   }
  ],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 6,
  "title": "Quanto tempo dura uma aposentadoria",
  "objective": "entender o horizonte do plano.",
  "keyPoints": [
   "O risco de viver mais que o dinheiro é real. Por isso o plano usa, por padrão, um horizonte até os 95 anos.",
   "Quanto mais longo o horizonte, maior o patrimônio necessário.",
   "Você pode mudar o horizonte nas premissas a qualquer momento."
  ],
  "questions": [
   {
    "prompt": "Por que o horizonte padrão vai até os 95 anos?",
    "options": [
     {
      "id": "a",
      "text": "Para não ficar sem dinheiro se você viver mais"
     },
     {
      "id": "b",
      "text": "Porque é a expectativa média de vida"
     },
     {
      "id": "c",
      "text": "Por exigência legal"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Aumentar o horizonte de 85 para 95 anos faz o patrimônio necessário:",
    "options": [
     {
      "id": "a",
      "text": "Cair"
     },
     {
      "id": "b",
      "text": "Subir"
     },
     {
      "id": "c",
      "text": "Ficar igual"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "O horizonte pode ser alterado?",
    "options": [
     {
      "id": "a",
      "text": "Sim, nas premissas"
     },
     {
      "id": "b",
      "text": "Não"
     },
     {
      "id": "c",
      "text": "Só pagando"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 7,
  "title": "Defina seu objetivo",
  "objective": "escolher idade e renda desejadas.",
  "keyPoints": [
   "Aposentar mais cedo significa menos anos acumulando e mais anos consumindo.",
   "Aposentadoria não precisa ser tudo ou nada: muita gente reduz o trabalho aos poucos.",
   "O objetivo orienta decisões; não é uma promessa nem uma regra fixa."
  ],
  "questions": [
   {
    "prompt": "Antecipar a aposentadoria em 5 anos geralmente:",
    "options": [
     {
      "id": "a",
      "text": "Reduz o aporte necessário"
     },
     {
      "id": "b",
      "text": "Aumenta o aporte necessário"
     },
     {
      "id": "c",
      "text": "Não muda nada"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "Por quê?",
    "options": [
     {
      "id": "a",
      "text": "Menos anos para acumular e mais anos para consumir"
     },
     {
      "id": "b",
      "text": "Os juros mudam"
     },
     {
      "id": "c",
      "text": "A inflação deixa de existir"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Seu objetivo é:",
    "options": [
     {
      "id": "a",
      "text": "Uma meta para orientar decisões"
     },
     {
      "id": "b",
      "text": "Uma promessa de resultado"
     },
     {
      "id": "c",
      "text": "Uma regra que não pode mudar"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": "set_goal",
  "actionText": "confirmar idade e renda desejadas."
 },
 {
  "day": 8,
  "title": "A reserva de emergência vem antes",
  "objective": "entender por que a reserva protege o plano de aposentadoria.",
  "keyPoints": [
   "Sem reserva, um imprevisto vira dívida ou resgate antecipado do dinheiro da aposentadoria.",
   "Para quem tem renda variável, muitos educadores financeiros sugerem de 6 a 12 meses de despesas.",
   "A reserva pede aplicação com resgate rápido e baixo risco.",
   "Dá para construir a reserva e começar a aposentadoria em paralelo, com valores menores."
  ],
  "questions": [
   {
    "prompt": "Por que a reserva vem antes?",
    "options": [
     {
      "id": "a",
      "text": "Evita resgatar a aposentadoria ou se endividar num imprevisto"
     },
     {
      "id": "b",
      "text": "Rende mais"
     },
     {
      "id": "c",
      "text": "É obrigatória por lei"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Para renda variável, uma referência comum é:",
    "options": [
     {
      "id": "a",
      "text": "1 mês de despesas"
     },
     {
      "id": "b",
      "text": "6 a 12 meses de despesas"
     },
     {
      "id": "c",
      "text": "5 anos de despesas"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "A característica mais importante da reserva é:",
    "options": [
     {
      "id": "a",
      "text": "Poder sacar rápido, com baixo risco"
     },
     {
      "id": "b",
      "text": "Ter o maior retorno possível"
     },
     {
      "id": "c",
      "text": "Ter prazo longo de carência"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 9,
  "title": "Do objetivo ao patrimônio-alvo",
  "objective": "entender como a renda desejada vira um valor a acumular.",
  "keyPoints": [
   "Patrimônio-alvo é quanto você precisa ter na aposentadoria para pagar a renda desejada até o fim do horizonte.",
   "Exemplo: R$ 8.000 por mês dos 60 aos 95 anos, com retorno real de 4%, pedem cerca de R$ 1,82 milhão em valores de hoje.",
   "Se você contar com um INSS estimado de R$ 4.500, o valor necessário cai para cerca de R$ 798 mil.",
   "O app faz essa conta por você e mostra as premissas."
  ],
  "questions": [
   {
    "prompt": "O patrimônio-alvo depende de:",
    "options": [
     {
      "id": "a",
      "text": "Renda desejada, horizonte e retorno"
     },
     {
      "id": "b",
      "text": "Só da sua idade"
     },
     {
      "id": "c",
      "text": "Do seu banco"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "No exemplo, considerar um INSS de R$ 4.500 reduz o alvo para cerca de:",
    "options": [
     {
      "id": "a",
      "text": "R$ 1,82 milhão"
     },
     {
      "id": "b",
      "text": "R$ 798 mil"
     },
     {
      "id": "c",
      "text": "Zero"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "O patrimônio-alvo é calculado em:",
    "options": [
     {
      "id": "a",
      "text": "Reais de hoje"
     },
     {
      "id": "b",
      "text": "Reais do futuro"
     },
     {
      "id": "c",
      "text": "Dólares"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 10,
  "title": "Retorno real e premissas honestas",
  "objective": "escolher premissas de retorno com prudência.",
  "keyPoints": [
   "O plano usa retorno real, acima da inflação. Os pontos de partida são 2% (conservador), 4% (central) e 6% (otimista) ao ano, e você pode mudar.",
   "Premissas otimistas demais fazem o plano parecer fácil e escondem o esforço necessário.",
   "Rentabilidade passada não garante rentabilidade futura."
  ],
  "questions": [
   {
    "prompt": "Retorno real é:",
    "options": [
     {
      "id": "a",
      "text": "O retorno acima da inflação"
     },
     {
      "id": "b",
      "text": "O retorno sem impostos"
     },
     {
      "id": "c",
      "text": "O retorno garantido"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Usar uma premissa de retorno alta demais tende a:",
    "options": [
     {
      "id": "a",
      "text": "Subestimar o aporte necessário"
     },
     {
      "id": "b",
      "text": "Superestimar o aporte necessário"
     },
     {
      "id": "c",
      "text": "Não mudar nada"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Rentabilidade passada:",
    "options": [
     {
      "id": "a",
      "text": "Garante a futura"
     },
     {
      "id": "b",
      "text": "Não garante a futura"
     },
     {
      "id": "c",
      "text": "É sempre igual à futura"
     }
    ],
    "correct": "b",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 11,
  "title": "Três cenários em vez de um número",
  "objective": "usar cenários para decidir com incerteza.",
  "keyPoints": [
   "O futuro é incerto; três cenários mostram uma faixa de resultados possíveis.",
   "Uma prática prudente: escolher o aporte olhando o cenário central e conferir se o conservador não fica longe demais.",
   "Os cenários mudam quando você muda as premissas, e o plano é revisado todo ano."
  ],
  "questions": [
   {
    "prompt": "Por que olhar três cenários?",
    "options": [
     {
      "id": "a",
      "text": "Porque o futuro é incerto"
     },
     {
      "id": "b",
      "text": "Para escolher o mais bonito"
     },
     {
      "id": "c",
      "text": "Por exigência legal"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Uma prática prudente é escolher o aporte com base:",
    "options": [
     {
      "id": "a",
      "text": "No cenário otimista"
     },
     {
      "id": "b",
      "text": "No central, conferindo o conservador"
     },
     {
      "id": "c",
      "text": "Em nenhum deles"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "Os cenários mudam quando:",
    "options": [
     {
      "id": "a",
      "text": "Você muda as premissas"
     },
     {
      "id": "b",
      "text": "Nunca"
     },
     {
      "id": "c",
      "text": "Só no fim do ano"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 12,
  "title": "Custos que parecem pequenos",
  "objective": "perceber o efeito dos custos no longo prazo.",
  "keyPoints": [
   "R$ 500 por mês durante 30 anos a 4% reais chegam a cerca de R$ 343 mil. A 3%, cerca de R$ 289 mil: cerca de R$ 53 mil a menos, ou 16%.",
   "Um custo de 1% ao ano tem praticamente o mesmo efeito.",
   "Em planos de previdência, vale olhar a taxa de administração e a taxa de carregamento antes de contratar.",
   "No app, você pode informar um custo anual nas premissas."
  ],
  "questions": [
   {
    "prompt": "No exemplo, 1 ponto percentual a menos por ano, em 30 anos, reduziu o resultado em cerca de:",
    "options": [
     {
      "id": "a",
      "text": "1%"
     },
     {
      "id": "b",
      "text": "16%"
     },
     {
      "id": "c",
      "text": "50%"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "Em planos de previdência, um custo a verificar é:",
    "options": [
     {
      "id": "a",
      "text": "A taxa de carregamento"
     },
     {
      "id": "b",
      "text": "O IPVA"
     },
     {
      "id": "c",
      "text": "A tarifa do Pix"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Quando comparar custos?",
    "options": [
     {
      "id": "a",
      "text": "Antes de contratar"
     },
     {
      "id": "b",
      "text": "Nunca"
     },
     {
      "id": "c",
      "text": "Só no resgate"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 13,
  "title": "Onde se guarda para o longo prazo (visão geral)",
  "objective": "conhecer os tipos de aplicação de longo prazo, sem recomendação de produto.",
  "keyPoints": [
   "Algumas opções comuns: títulos públicos atrelados à inflação, planos de previdência (PGBL e VGBL), fundos e ETFs.",
   "PGBL: permite deduzir as contribuições da base do imposto de renda, até 12% da renda bruta tributável, para quem faz a declaração completa (há outras condições). No resgate, o imposto incide sobre o valor total.",
   "VGBL: não tem dedução; no resgate, o imposto incide só sobre os rendimentos. Desde 2026, aportes em VGBL acima de R$ 600 mil por ano, somando todas as seguradoras, pagam IOF de 5% sobre o excedente.",
   "Desde 2024, quem tem previdência pode escolher o regime de tributação (progressivo ou regressivo) até o primeiro resgate ou o início do benefício.",
   "Este app não recomenda produtos. Para escolher, compare custos e regras e, se precisar, consulte um profissional habilitado."
  ],
  "questions": [
   {
    "prompt": "O PGBL tende a fazer mais sentido para quem:",
    "options": [
     {
      "id": "a",
      "text": "Faz a declaração completa do imposto de renda"
     },
     {
      "id": "b",
      "text": "É isento de imposto"
     },
     {
      "id": "c",
      "text": "Quer resgatar em seis meses"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "No VGBL, o imposto no resgate incide sobre:",
    "options": [
     {
      "id": "a",
      "text": "O valor total"
     },
     {
      "id": "b",
      "text": "Apenas os rendimentos"
     },
     {
      "id": "c",
      "text": "Nada"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "Desde 2024, o regime de tributação da previdência pode ser escolhido:",
    "options": [
     {
      "id": "a",
      "text": "Até o primeiro resgate ou o início do benefício"
     },
     {
      "id": "b",
      "text": "Só na contratação"
     },
     {
      "id": "c",
      "text": "Depois do último resgate"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [
   {
    "label": "Lei 14.803/2024 (KPMG)",
    "url": "https://midia.kpmg.com.br/site/2024/01/COM240118-EXTERNO-TAX-NEWS-Financial-Services-Novas-Normas.html"
   },
   {
    "label": "IOF sobre VGBL em 2026 (Brasil 61)",
    "url": "https://brasil61.com/n/novas-regras-do-iof-sobre-vgbl-entram-em-vigor-em-2026-bras2515406"
   }
  ],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 14,
  "title": "Monte seu plano",
  "objective": "criar o plano com um aporte possível hoje.",
  "keyPoints": [
   "Escolha um aporte que caiba no seu orçamento hoje, mesmo que seja menor do que o necessário.",
   "O app mostra o aporte necessário e a distância até ele. Começar e revisar vale mais do que esperar o valor ideal.",
   "O aporte é uma decisão sua, não uma recomendação do app."
  ],
  "questions": [
   {
    "prompt": "Se o aporte necessário não cabe hoje, o melhor é:",
    "options": [
     {
      "id": "a",
      "text": "Não começar"
     },
     {
      "id": "b",
      "text": "Começar com o que cabe e revisar"
     },
     {
      "id": "c",
      "text": "Apostar para acelerar"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "O plano deve ser revisado:",
    "options": [
     {
      "id": "a",
      "text": "Quando a vida muda e uma vez por ano"
     },
     {
      "id": "b",
      "text": "Nunca"
     },
     {
      "id": "c",
      "text": "Todos os dias"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "O valor do aporte é:",
    "options": [
     {
      "id": "a",
      "text": "Uma decisão sua"
     },
     {
      "id": "b",
      "text": "Uma recomendação do app"
     },
     {
      "id": "c",
      "text": "Uma obrigação legal"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": "create_plan",
  "actionText": "salvar o plano."
 },
 {
  "day": 15,
  "title": "Pague-se primeiro",
  "objective": "automatizar o aporte.",
  "keyPoints": [
   "\"Pagar-se primeiro\" é separar o aporte assim que o dinheiro entra, e não guardar o que sobra no fim do mês.",
   "Programe uma transferência automática no seu banco para o dia em que você recebe.",
   "O app não movimenta dinheiro: quem programa é você."
  ],
  "questions": [
   {
    "prompt": "\"Pagar-se primeiro\" significa:",
    "options": [
     {
      "id": "a",
      "text": "Separar o aporte assim que o dinheiro entra"
     },
     {
      "id": "b",
      "text": "Guardar o que sobrar no fim do mês"
     },
     {
      "id": "c",
      "text": "Gastar primeiro com você mesmo"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "O melhor dia para a transferência é:",
    "options": [
     {
      "id": "a",
      "text": "Logo depois de receber"
     },
     {
      "id": "b",
      "text": "O último dia do mês"
     },
     {
      "id": "c",
      "text": "Qualquer dia aleatório"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Quem programa a transferência?",
    "options": [
     {
      "id": "a",
      "text": "Você, no seu banco"
     },
     {
      "id": "b",
      "text": "O app"
     },
     {
      "id": "c",
      "text": "O INSS"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 16,
  "title": "Renda variável sem drama",
  "objective": "ter uma regra de aporte que funcione com renda irregular.",
  "keyPoints": [
   "Uma regra simples: um aporte mínimo fixo todo mês e um percentual extra nos meses bons.",
   "Para PJ, definir um \"salário\" fixo para si ajuda a separar as finanças pessoais das da empresa.",
   "Nos meses bons, o extra pode ir primeiro para completar a reserva de emergência."
  ],
  "questions": [
   {
    "prompt": "Uma estratégia para renda variável é:",
    "options": [
     {
      "id": "a",
      "text": "Aporte mínimo fixo e extra nos meses bons"
     },
     {
      "id": "b",
      "text": "Só aportar quando sobrar"
     },
     {
      "id": "c",
      "text": "Aportar tudo de uma vez num mês"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Para PJ, definir um salário fixo para si ajuda a:",
    "options": [
     {
      "id": "a",
      "text": "Separar finanças pessoais e da empresa"
     },
     {
      "id": "b",
      "text": "Pagar sempre menos imposto"
     },
     {
      "id": "c",
      "text": "Nada"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Nos meses bons, o extra pode ir primeiro para:",
    "options": [
     {
      "id": "a",
      "text": "Completar a reserva de emergência"
     },
     {
      "id": "b",
      "text": "Apostas"
     },
     {
      "id": "c",
      "text": "Compras por impulso"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 17,
  "title": "O mês difícil",
  "objective": "saber o que fazer quando não dá para aportar.",
  "keyPoints": [
   "Reduzir ou pausar não é desistir. O importante é retomar.",
   "Pegar empréstimo para manter o aporte quase nunca faz sentido: os juros do crédito costumam ser maiores que o retorno.",
   "No app, um mês sem aporte fica registrado e o plano segue."
  ],
  "questions": [
   {
    "prompt": "Num mês apertado, o mais saudável é:",
    "options": [
     {
      "id": "a",
      "text": "Desistir do plano"
     },
     {
      "id": "b",
      "text": "Reduzir ou pausar e retomar depois"
     },
     {
      "id": "c",
      "text": "Usar o cartão de crédito para aportar"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "Pegar empréstimo para manter o aporte:",
    "options": [
     {
      "id": "a",
      "text": "Geralmente não faz sentido"
     },
     {
      "id": "b",
      "text": "É o recomendado"
     },
     {
      "id": "c",
      "text": "É obrigatório"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "No app, um mês sem aporte:",
    "options": [
     {
      "id": "a",
      "text": "Apaga seu progresso"
     },
     {
      "id": "b",
      "text": "Fica registrado e você segue"
     },
     {
      "id": "c",
      "text": "Bloqueia sua conta"
     }
    ],
    "correct": "b",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 18,
  "title": "Constância vale mais que valor",
  "objective": "entender como o app mede progresso.",
  "keyPoints": [
   "Registrar o aporte do mês dá o mesmo XP para qualquer valor. O que conta é a regularidade.",
   "Seu progresso é comparado com a sua própria trajetória, nunca com a de outras pessoas.",
   "O fio da constância mostra mês a mês o hábito que você está construindo."
  ],
  "questions": [
   {
    "prompt": "No app, quem ganha mais XP ao registrar um aporte?",
    "options": [
     {
      "id": "a",
      "text": "Quem aporta mais"
     },
     {
      "id": "b",
      "text": "Todos ganham o mesmo"
     },
     {
      "id": "c",
      "text": "Quem tem mais patrimônio"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "O que mais influencia o resultado no longo prazo?",
    "options": [
     {
      "id": "a",
      "text": "Regularidade e tempo"
     },
     {
      "id": "b",
      "text": "Acertar o melhor mês"
     },
     {
      "id": "c",
      "text": "Sorte"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Com quem comparar seu progresso?",
    "options": [
     {
      "id": "a",
      "text": "Com a sua própria trajetória"
     },
     {
      "id": "b",
      "text": "Com o patrimônio dos amigos"
     },
     {
      "id": "c",
      "text": "Com influenciadores"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 19,
  "title": "Quando revisar o plano",
  "objective": "criar o hábito de revisão.",
  "keyPoints": [
   "Revisão rápida todo mês: menos de um minuto para confirmar as premissas.",
   "Ajuste quando a vida muda: renda, família, trabalho, cidade.",
   "Revisão completa uma vez por ano.",
   "Revisar para baixo faz parte do processo."
  ],
  "questions": [
   {
    "prompt": "Qual destes é um motivo para ajustar o plano?",
    "options": [
     {
      "id": "a",
      "text": "Mudança de renda"
     },
     {
      "id": "b",
      "text": "Troca de celular"
     },
     {
      "id": "c",
      "text": "Um app novo"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Com que frequência fazer a revisão completa?",
    "options": [
     {
      "id": "a",
      "text": "Uma vez por ano"
     },
     {
      "id": "b",
      "text": "Todos os dias"
     },
     {
      "id": "c",
      "text": "A cada dez anos"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "Revisar o plano para baixo é:",
    "options": [
     {
      "id": "a",
      "text": "Um fracasso"
     },
     {
      "id": "b",
      "text": "Parte normal do processo"
     },
     {
      "id": "c",
      "text": "Proibido"
     }
    ],
    "correct": "b",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 20,
  "title": "Armadilhas no caminho",
  "objective": "reconhecer promessas e práticas perigosas.",
  "keyPoints": [
   "Retorno alto e \"garantido\" é sinal de alerta de golpe.",
   "Apostas são entretenimento com perda esperada, não investimento.",
   "Nunca compartilhe senhas nem códigos de acesso. Desconfie de urgência."
  ],
  "questions": [
   {
    "prompt": "\"Retorno garantido de 5% ao mês\" é:",
    "options": [
     {
      "id": "a",
      "text": "Uma oportunidade"
     },
     {
      "id": "b",
      "text": "Um sinal de alerta"
     },
     {
      "id": "c",
      "text": "Normal no mercado"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "Apostas esportivas são:",
    "options": [
     {
      "id": "a",
      "text": "Uma forma de investimento"
     },
     {
      "id": "b",
      "text": "Entretenimento com perda esperada"
     },
     {
      "id": "c",
      "text": "Previdência"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "Alguém pede sua senha para \"investir por você\". Você:",
    "options": [
     {
      "id": "a",
      "text": "Aceita"
     },
     {
      "id": "b",
      "text": "Recusa"
     },
     {
      "id": "c",
      "text": "Negocia"
     }
    ],
    "correct": "b",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": null,
  "actionText": null
 },
 {
  "day": 21,
  "title": "Seu primeiro aporte",
  "objective": "registrar o primeiro aporte e entrar no ciclo mensal.",
  "keyPoints": [
   "Registre o aporte que você fez (ou vai fazer) este mês. O valor é opcional e só você vê.",
   "Ative o lembrete mensal no dia em que seu dinheiro entra.",
   "A partir de agora: uma missão por semana, o registro mensal e a revisão anual."
  ],
  "questions": [
   {
    "prompt": "O que acontece depois do dia 21?",
    "options": [
     {
      "id": "a",
      "text": "O app acaba"
     },
     {
      "id": "b",
      "text": "Começam as missões semanais e o registro mensal"
     },
     {
      "id": "c",
      "text": "Você precisa recomeçar"
     }
    ],
    "correct": "b",
    "explanation": ""
   },
   {
    "prompt": "O lembrete mensal serve para:",
    "options": [
     {
      "id": "a",
      "text": "Registrar o aporte e revisar rápido o plano"
     },
     {
      "id": "b",
      "text": "Vender produtos"
     },
     {
      "id": "c",
      "text": "Cobrar uma taxa"
     }
    ],
    "correct": "a",
    "explanation": ""
   },
   {
    "prompt": "O mais importante agora é:",
    "options": [
     {
      "id": "a",
      "text": "Manter a constância"
     },
     {
      "id": "b",
      "text": "Buscar o maior retorno"
     },
     {
      "id": "c",
      "text": "Trocar de aplicação todo mês"
     }
    ],
    "correct": "a",
    "explanation": ""
   }
  ],
  "sources": [],
  "actionKey": "first_contribution",
  "actionText": "registrar o aporte e ativar o lembrete."
 }
];
