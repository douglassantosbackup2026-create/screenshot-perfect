# Análise: SooX × Previdência Intelligence

## Contexto
A engenharia reversa do SooX (ANALISE.md + 44 prints) descreve um simulador de aposentadoria e planejamento financeiro de longo prazo. Este projeto, o **Previdência Intelligence**, é da mesma categoria: aposentadoria sem depender do INSS, para PJ, MEI e autônomos. Esta análise cruza o que o SooX faz com o que já existe no código. O objetivo é decidir o que adotar, o que adaptar e o que ignorar.


---

## 1. Posicionamento: mesmo problema, públicos diferentes

| | SooX | Previdência Intelligence |
|---|---|---|
| Público | Quem já tem patrimônio: o exemplo tem R$ 649 mil em ativos, CDB, LCI, FII e financiamento SAC | PJ, MEI e autônomos começando: a persona do seed, Ana, tem 30 anos |
| Promessa | "Seu dinheiro vai durar a vida toda?" | "Aposentadoria sem depender do INSS" |
| Motor | Mensal e nominal, com curva de Selic, CDI e IPCA, IR por regime, Monte Carlo e solver | Real (em reais de hoje), 3 cenários (2%, 4% e 6%), fórmulas fechadas em `src/lib/calc/retirement.ts` |
| Diferencial | Profundidade analítica: Raio-X, FGC, ALM | Hábito e educação: programa de 21 dias, missões, XP, diário, orçamento |
| Retenção | Snapshots mensais, alerta de desvio e streak de registro | Streaks, missões, fechamento do mês e conquistas |

**Conclusão:** não vale copiar a profundidade do SooX. Ela atende um público com carteira diversificada e exigiu cerca de 1.500 commits em 3 meses. O que vale importar são os padrões de produto. Os mais úteis: paywall dirigido por dados, sandbox "E se…?", baseline × real e "o que fazer agora". Eles reforçam o diferencial de hábito do Previdência Intelligence em vez de competir em complexidade.

---

## 2. O que já temos equivalente (não precisa construir)
- **Plano exemplo / modo demo:** `src/lib/data/demo-store.ts` com o seed da Ana. É o mesmo funil do "Plano de exemplo" do SooX.
- **Ocultar valores:** `profile.hideValues`, equivalente ao olho com `R$ ••••••` do SooX.
- **Cenários:** `simulateAll` (conservador, central e otimista).
- **Sensibilidade:** `sensitivity` e `projectSeries` em `src/lib/calc/retirement.ts`.
- **Esforço mínimo (parte do goal seek):** `requiredContribution`, `sustainableIncome` e `depletionAge` já respondem "quanto aportar", "quanto posso retirar" e "quando acaba".
- **Patrimônio e histórico:** `src/lib/calc/networth.ts` e `progress.ts` (`selfComparison`, `fiMilestones`).
- **Fotos do plano:** a tabela `plan_snapshots` e o campo `snapshots` no store. É o embrião do baseline congelado.
- **Dados faltantes:** `profile.missingFields`. É o embrião do `data_quality.issues`.
- **Disclaimer educacional:** `src/routes/sobre.tsx`.

---

## 3. Lacunas, por prioridade

### P0: risco atual, corrigir antes de vender
1. **Faltam tabelas e a RPC de pagamento nas migrations.** `payments`, `entitlements` e a RPC `credit_payment` aparecem em `src/integrations/supabase/types.ts` e o webhook as usa. Nenhuma migration do repositório cria esses objetos. Num banco novo, o webhook do Mercado Pago falha.
2. **Não há nenhum gate de feature.** O Premium é cobrado (`src/lib/billing/`), mas nenhuma tela verifica se o usuário tem acesso. O que é Premium hoje só aparece no texto de `src/content/pricing.ts`.

### P1: padrões do SooX com melhor custo-benefício
3. **Feature matrix como dado.** Criar `src/lib/entitlements/matrix.ts` com `key`, `area`, `value_type` e o valor por tier, e um hook `useFeature(key)`. O plano gratuito ganha cadeado com modal de upgrade, e `/` usa `?feature=` para destacar o tier mínimo.
   - A página de preços passa a ser gerada da matriz, no lugar do texto fixo em `pricing.ts`.
   - Formas de bloqueio, como no SooX: cadeado na ação, conteúdo borrado e card de página inteira. O borrado mostra que o recurso existe e converte melhor que esconder.
4. **"E se…?" no `/plano`:** sliders de aporte, idade de aposentadoria, renda desejada, retorno e INSS, comparando BASE × CENÁRIO lado a lado.
   - Depois vem a escolha entre **Restaurar** e **Salvar como nova foto**, que grava em `snapshots` com motivo. O plano base nunca muda sem querer.
   - Toda a conta continua em `simulate()`. A tela não calcula nada, conforme o AGENTS.md.
5. **Goal seek: "com quantos anos posso parar?"** É a pergunta mais forte do SooX ("Quando você vai poder parar de trabalhar?") e hoje não tem resposta direta.
   - Entra como função pura `earliestRetirementAge(inputs)` em `src/lib/calc/retirement.ts`.
   - Faz busca inteira ou bisseção sobre `simulate`, com teste Vitest.
   - Também respondem: "quando posso parar de aportar" e "aporte único hoje".
6. **Projetado × real com corredor.** Os 3 cenários já formam o corredor: o conservador é a borda baixa e o otimista a alta.
   - Compara `wealthEntries` com a projeção da foto ancorada, que não muda quando o plano é editado.
   - O veredito sai de uma função pura `progressVerdict()`: "No ritmo", "Levemente atrás" ou "Atrás".
   - Acompanha o impacto em meses na data da aposentadoria e um alerta no `/hoje`.
   - Encaixa direto em `/evolucao` e no `/fechamento` mensal.

### P2: relevantes para o público PJ, mas exigem cuidado
7. **PGBL × VGBL e tabela regressiva × progressiva.** É a dúvida número 1 de quem guarda para aposentadoria, e o SooX trata. Começar com uma calculadora educativa (função pura com testes contra exemplos da Receita Federal), sem integrar ao motor principal.
   - PJ no Simples ou no lucro presumido normalmente não aproveita a dedução do PGBL. Esse ponto é educativo e diferencia o produto.
8. **"Vale a pena quitar a dívida?"** Hoje só existe `hasOverdueDebt` (sim/não) e dívida como categoria de ativo. Basta adicionar taxa e parcela à dívida e comparar o custo real com o retorno real do plano (Fisher, como no SooX). Conecta com a lição "a reserva vem antes".
9. **Mini Raio-X em `/patrimonio`.** Concentração (HHI e maior posição), liquidez (quanto vira dinheiro em 30 dias), dados incompletos e o que cada falta afeta, e uma lista **"O que fazer agora"** com link para a evidência. Reaproveita `allocation` de `portfolio.ts` e `summarizeAssets` de `assets.ts`.

### Não fazer (por ora)
- **Monte Carlo com block-bootstrap e núcleo em Rust:** desproporcional para o público. Os 3 cenários comunicam melhor a incerteza para quem está começando.
- **Motor nominal com curva de Selic, CDI e IPCA, 38 instrumentos, FGC por conglomerado e ALM.** Servem quem tem carteira de renda fixa grande.
- **Modo assessor B2B, white-label e importação XP.**

---

## 4. Erros do SooX que devemos evitar
- **Rótulo que não bate com a fórmula:** "Dívida/Patrimônio" é calculado como passivo ÷ ativo. Regra: cada métrica tem uma função em `src/lib/calc/`, e o nome da função é o rótulo.
- **Dois caminhos de agregação:** o extrato mostra impostos R$ 0 e o cenário mostra R$ 1,07 mi. Base e cenário devem passar pela mesma função `simulate()`.
- **Nomes de tier inconsistentes:** a API chama de `free` o Basic, que é pago. Um único catálogo deve alimentar `pricing.ts`, `src/lib/billing/catalog.ts`, os Termos e a matriz.
- **Vender recurso desligado:** o Pro é vendido "para assessores" com o modo assessor desligado em todos os tiers. Hoje nosso `pricing.ts` promete "IA" e "relatórios": verificar se existem antes do go-live.
- **Roadmap exposto na UI** ("chega numa próxima entrega") **e changelog interno no bundle.**

---

## 5. Preço: comparação
| | SooX (web) | Previdência Intelligence |
|---|---|---|
| Entrada | Basic R$ 29,90/mês · R$ 118,80/ano | Gratuito R$ 0 |
| Meio | Essential R$ 44,90 · R$ 178,80/ano | Inteligência R$ 29,90/mês · R$ 239,90/ano |
| Topo | Pro R$ 69,90 · R$ 274,80/ano | Pro R$ 59,90/mês |

O SooX dá 67% de desconto no anual. O nosso anual sai mais caro que o anual do Basic deles. Vale reavaliar, ou justificar pelo componente educativo e de hábito. Nosso plano gratuito real é uma vantagem de aquisição que o SooX não tem: lá o "Sem plano" só vê o exemplo.

## 6. Checklist jurídico (Brasil)
- **Disclaimer "ferramenta educacional, não é consultoria (CVM Res. 19/21)":** confirmar em `/sobre` e no rodapé do `/plano`.
- **Arrependimento de 7 dias (CDC art. 49)** no checkout do Mercado Pago.
- **Exportar meus dados em JSON (LGPD art. 18, V):** verificar em `/perfil`. A exclusão de conta já existe.
- **Data de nascimento só com o ano:** já guardamos `birthYear`, que é a mesma minimização de dados do SooX.

---

## Sequência recomendada
1. P0-1: migration de `payments`, `entitlements` e `credit_payment`.
2. P1-3: feature matrix + gate + modal.
3. P1-5: idade mínima de aposentadoria (calc + teste) junto com P1-4 "E se…?".
4. P1-6: projetado × real com corredor.
5. P2 conforme a resposta dos usuários.

## Verificação (quando cada item for implementado)
- `npx vitest run` para cada nova função em `src/lib/calc/`.
- Rodar o app e conferir: no plano gratuito aparecem cadeado e modal; no Premium a tela abre; no "E se…?", **Restaurar** volta ao base e **Salvar** cria uma foto em `snapshots`.
- Aplicar as migrations num banco limpo e simular o webhook do Mercado Pago.
