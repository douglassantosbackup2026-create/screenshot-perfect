# Página de vendas como home + fluxo sem login

## O que muda para você
- A home (`/`) vira uma página de vendas completa, longa, mobile first, no visual atual (azul petróleo, ipê só para progresso, sem gradientes, sem promessas de rendimento).
- Todos os botões levam a um fluxo que funciona sem login: home → onboarding → Hoje (dia 1), com dados no aparelho (modo demonstração).
- A calculadora rápida atual continua dentro da página de vendas.

## Seções da página
1. Topo: título "Quanto falta para você se aposentar sem depender do INSS?", subtítulo curto, botão "Começar grátis" e link "Ver um exemplo".
2. Calculadora rápida (a mesma de hoje, cálculos do motor existente). Botão "Montar meu plano em 21 dias" guarda os valores e abre o onboarding já preenchido.
3. O problema: 3 frases curtas sobre INSS, inflação e falta de constância (sem culpa, sem alarmismo).
4. Como funciona: 3 passos (lição de 5 min por dia, plano pronto no dia 14, registro mensal e fio da constância).
5. Prévia do produto: cartões ilustrativos de Hoje, Plano e Diário, desenhados em código (sem números inventados apresentados como reais; rótulo "exemplo").
6. Os 21 dias: lista dos títulos das lições vindos do conteúdo existente, agrupados por semana.
7. O que não fazemos: não vendemos investimentos, não pedimos senha do banco, não movimentamos dinheiro.
8. Planos: Gratuito (programa de 21 dias, calculadora, diário) e Premium (R$ 29,90/mês ou R$ 239,90/ano, conforme spec) marcado "Em breve" — botão "Avisar quando lançar" (guarda o e-mail com consentimento explícito, igual ao lead da calculadora). Sem cobrança agora, pois a spec só libera o Premium depois do Gate 2.
9. Perguntas frequentes (acordeão): é investimento? preciso dar dados do banco? quanto tempo por dia? e se eu atrasar um dia? os valores são garantidos? (resposta: são simulações).
10. Chamada final + rodapé legal atual.

## Fluxo sem login
```text
/  --"Começar grátis"-------------> /onboarding (vazio) --> /hoje
/  --calculadora "Montar plano"---> /onboarding (pré-preenchido) --> /hoje
/  --"Ver um exemplo"-------------> carrega demo da Ana --> /hoje
/  --"Avisar quando lançar"-------> confirmação na própria página
```
- `/entrar` deixa de ser passagem obrigatória; continua existindo para o futuro login.
- Cabeçalho da home: "Entrar" vira "Abrir o app" quando já existe progresso salvo no aparelho.

## Detalhes técnicos
- Reescrever `src/routes/index.tsx`; seções em `src/components/sales/*`. Head com title/description/og próprios.
- CTAs usam funções já existentes do `demo-store` (reset/seed demo, prefill via `CALC_PREFILL_KEY`) e navegam direto para `/onboarding` ou `/hoje`.
- Lista de espera: insert na tabela de leads existente com flag de consentimento; preços como constantes em `src/content/pricing.ts` (só exibição).
- Accordion do shadcn para o FAQ. Sem novas dependências.
- Verificar com Playwright os quatro caminhos do fluxo.
