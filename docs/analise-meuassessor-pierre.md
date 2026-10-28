# Planejamento financeiro do dia a dia: o que levar do Meu Assessor e do Pierre

**Data:** 27/10/2026
**Base:** engenharia reversa pública do Meu Assessor e do Pierre (ANALISE.md de cada um, 24/10/2026) cruzada com o código do Previdência Intelligence.

Companheira de [analise-soox.md](analise-soox.md). O SooX é referência para o **plano de aposentadoria**. Meu Assessor e Pierre são referência para o **dia a dia do dinheiro**: gasto, orçamento, contas, avisos.

---

## 1. Os três em uma linha

| | Meu Assessor | Pierre | Previdência Intelligence |
|---|---|---|---|
| Canal | WhatsApp (painel é complemento) | App (WhatsApp é complemento) | Web app |
| Entrada de dados | Frase, áudio, foto de boleto | Open Finance (Pluggy), só leitura | Lançamento manual, importação OFX/CSV, recorrências |
| O que vende | "Escritório" de 6 assessores com nome e rosto | Agentes-monitor, cartão com cashback, CDB, agente que compra | Aposentadoria sem depender do INSS, com hábito e educação |
| Preço | Plano único, 12× R$ 29,90 | Grátis / R$ 39 / R$ 199 por mês | Grátis / R$ 29,90 / Pro |
| Reclame Aqui | 6,8 (cancelamento e cobrança do anual) | 8,7 | — |

Os dois concorrentes moram em finanças do dia a dia. Nós moramos no longo prazo. O planejamento financeiro do dia a dia entra aqui como **o caminho para sobrar dinheiro para a aposentadoria**, não como um produto separado.

## 2. O que já tínhamos (e eles também têm)

| Recurso | Meu Assessor | Pierre | Nós |
|---|---|---|---|
| Lançamento com categoria automática | Sim (por frase) | Sim (Open Finance) | Sim (regras em `categorize.ts`) |
| Orçamento por categoria | Teto mensal, sem rolar saldo | Limite por período (dia, semana, quinzena, mês) | **Envelopes com saldo que passa para o mês seguinte**, metas por modelo e envelope Aposentadoria ligado ao plano |
| Recorrências | Sim | Lembretes de pagamento | Sim, com ajuste de fim de semana |
| Importar extrato | Open Finance | Open Finance | OFX/CSV com deduplicação |
| Relatórios | Arquivo na conversa, painel por pedido | Relatórios no Pro | Fluxo de caixa, tendência por categoria, patrimônio por grupo |
| Fechamento do mês | — | — | **5 passos com XP** (diferencial nosso) |

Nosso orçamento já é mais completo que o dos dois. Faltava a camada **proativa** e a camada de **segurança** que eles vendem.

## 3. O que adotamos agora (onda 1, implementada)

Toda conta mora em `src/lib/calc/`, em funções puras com teste. As telas só mostram o resultado.

| Recurso | Inspirado em | Onde | Plano |
|---|---|---|---|
| **Aviso de orçamento** a partir de 75% e no limite | Martin ("já foi 78% do orçamento"), limites do Pierre (50/75/100%) | `calc/alerts.ts` (`budgetAlerts`); barra "% usado" no envelope; card em `/hoje` e `/diario`; aviso logo depois de lançar | Grátis |
| **Compra parcelada** (2 a 60×), com o selo "3/10" | "comprei a TV em 10x de 150" | `calc/installments.ts`; a parcela é uma recorrência mensal com fim; o resto dos centavos vai na 1ª | Grátis |
| **Comprometido nos próximos meses** | Meu Assessor ("projeção de parcelados") | `committedByMonth`; card no `/diario` com barras por mês e "cancelar as próximas" | Grátis |
| **Fim do mês**: saldo hoje + agendado − agendado, e o dia em que o saldo fica negativo | Meu Assessor ("projetado", "dias no azul") | `calc/forecast.ts` (`monthEndProjection`); card no `/diario` | Inteligência |
| **Cobrança repetida** | Albert / Martin | `duplicateCharges`: mesma conta, valor e descrição em até 3 dias; parcelas e recorrências ficam de fora | Inteligência |
| **Assinatura que mudou de preço** | Martin ("streaming subiu de 39,90 para 55,90") | `priceChanges`: cobrança única por mês em ≥ 3 meses seguidos, variação > 5% | Inteligência |
| **Gasto ou fatura acima da média** | Martin ("fatura 18% acima da média de 3 meses") | `aboveAverage`: > 15% e > R$ 50 acima da média dos 3 meses anteriores | Inteligência |
| **Ignorar aviso** | — | `demo.dismissAlert`: o aviso ignorado não volta | — |
| **Recibo + Desfazer** | Recibo com Editar/Desfazer por 24 h do Meu Assessor | Toast "Lançado: R$ 62 em Saúde · No mês: R$ 214 de R$ 400" com Desfazer; "Desfazer" no `/diario` por 24 h (`demo.undoLast`) | Grátis |
| **Reserva de emergência** | "A reserva vem antes" (lição do programa) | `calc/reserve.ts`: custo essencial (média de 3 meses de moradia, mercado, transporte, saúde, educação, impostos e contas fixas) × 6; atalho para criar o envelope com meta em 12 meses | Grátis |

**Por que esse corte de plano:** o que protege (aviso de orçamento, parcelas, reserva, desfazer) fica no grátis. O que antecipa ("fim do mês" e os avisos de cobrança) é o motivo para assinar. Enquanto a cobrança estiver desligada, tudo fica liberado (`VITE_BILLING_ENABLED`).

## 4. Onda 2 (implementada)

| Recurso | Inspirado em | Onde | Plano |
|---|---|---|---|
| **Limites de gasto por período** (dia, semana de segunda a domingo, quinzena 1–15/16–fim, mês), por categoria ou no total, com aviso a partir de 75% | Monitores e limites do Pierre | `calc/limits.ts` (`periodRange`, `limitUsage`); botão "Limites" no `/diario`; avisos em `/hoje` | 1 limite no grátis; ilimitados no Inteligência (`canCreateLimit`) |
| **Lançamento por frase** ("gastei 62 na farmácia", "comprei uma cadeira em 6x de 95", "almoço de ontem, 39") | Meu Assessor | `calc/quickEntry.ts` (`parseEntry`), sem IA: valor, entrada/saída, data relativa, parcelas e categoria por palavra-chave. As regras da pessoa vêm antes. **Nunca grava sozinho**: abre o lançamento preenchido para conferir e, sem valor, pede o valor | Grátis |
| **Vale a pena quitar a dívida?** | P2 do SooX | `calc/debt.ts`: custo real (Fisher) contra o retorno real do plano → quitar / investir / tanto faz; meses até quitar pela parcela. Juros e parcela no formulário da dívida em `/patrimonio` | Grátis |
| **Raio-X do patrimônio** | P2 do SooX | `calc/xray.ts`: concentração (HHI e maior item), liquidez em 30 dias e "o que fazer agora" (dívidas > 50%, reserva incompleta, dívida sem juros, item > 60%, dados com mais de 90 dias) | Inteligência |
| **PGBL ou VGBL?** | P2 do SooX | `calc/pensionTax.ts`: tabela regressiva, limite de 12%, restituição reinvestida, o que passa de 12% vai para o VGBL; declaração simplificada → VGBL. Card em `/plano` | Grátis |

Também entraram:
- **Ocorrência excluída não volta.** Uma parcela ou recorrência excluída fica marcada na regra (`skipped`) e não é lançada de novo. O "Desfazer" traz ela de volta.
- **O exemplo da Ana mostra os recursos.** Ela agora tem o notebook em 10×, o streaming que subiu de R$ 39,90 para R$ 55,90 e a farmácia lançada duas vezes.
- **Os avisos aparecem no fechamento do mês**, sem contar como passo.

## 5. Próxima onda (registrado, não implementado)

1. **Foto de boleto ou recibo** → lançamento proposto para confirmar. Precisa de um provedor de OCR ou de IA.
2. **Avisos por e-mail ou push**, com limite de frequência por pessoa. Precisa de um serviço de envio.
3. **Trocar o `user_state` (jsonb) pelas tabelas normalizadas e pelas RPCs.** Isso inclui levar limites, parcelas e avisos ignorados para o banco.

## 6. O que não copiamos (e por quê)

- **WhatsApp como canal principal, Open Finance e agente que compra (Computer, cartão agêntico):** exigem número homologado pela Meta, um agregador (Pluggy) ou licença financeira. O Meu Assessor depende de uma exceção da Meta para números +55; esse é o maior risco de plataforma dele.
- **Personas com nome, rosto e métricas inventadas** ("98% de satisfação", "187 mil seguidores").
- **Promessas absolutas desmentidas por outro produto:** o "nunca movimenta seu dinheiro" do Pierre convive com um cartão que compra sozinho.
- **Aceite pré-marcado no checkout** (Meu Assessor) e **simulador que esconde condições** (cashback do Pierre).
- **Chave de API com acesso total, aceita na URL** (Pierre).

## 7. Lições de produto que valem para nós

1. **Uma fonte de verdade para regras de negócio.** O Pierre tem 14 inconsistências públicas entre site, ajuda, documentação e termos. Os números de usuários do Meu Assessor variam de 200 mil a 300 mil conforme a página. Aqui, `src/lib/entitlements/matrix.ts` diz o que cada plano libera e `src/content/pricing.ts` diz o preço. Pendente: gerar os cards de preço da matriz.
2. **Cancelamento fácil é parte do produto.** A nota 6,8 do Meu Assessor vem de cancelamento e cobrança do anual. Quando o Mercado Pago entrar, o cancelamento em `/perfil` precisa ser de um clique, e o arrependimento de 7 dias tem que estar explícito.
3. **Aviso tem que ter motivo e evidência.** Todo aviso nosso diz o porquê ("39,90 → 55,90", "18% acima de R$ 1.000"), leva aos lançamentos e pode ser ignorado.
4. **Aprovação proporcional ao risco.** O Meu Assessor desfaz em 24 h. O Pierre pede toque + PIN e tetos para ações irreversíveis. Nós só temos ações reversíveis, então o "Desfazer" basta.

## 8. Como verificar

- **Testes:** `npx vitest run` cobre `alerts`, `installments`, `forecast`, `reserve` e, em `demo-store.test.ts`, parcelas, desfazer e ignorar aviso.
- **No app, em modo demonstração:**
  - Lance uma saída grande numa categoria com envelope: aparece o recibo com Desfazer e, se passar de 75%, o aviso.
  - Lance uma compra parcelada em 10×: aparecem o selo "1/10", o card "Comprometido" e o efeito no "Fim do mês".
  - Em desenvolvimento, `localStorage.pi_tier_preview = "free"` mostra "Fim do mês" borrado e os avisos de cobrança atrás do convite.
