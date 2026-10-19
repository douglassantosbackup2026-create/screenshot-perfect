# Todas as telas agora, login depois

O login fica para depois. Nesta rodada construo todas as telas da seção 9, completas e navegáveis no preview.

## Como as telas funcionam sem login
- **Página inicial e Calculadora:** já funcionam de verdade, porque não precisam de login. Usam o motor de cálculo, e o e-mail é gravado em `leads` só com o consentimento marcado.
- **Telas logadas** (Onboarding, Hoje, Lição, Plano, Diário, Perfil, Admin): ficam abertas por enquanto, em **modo demonstração**.
  - Usam uma pessoa de exemplo ("Ana", caso A da seção 7.4).
  - O que você faz na tela (registrar aporte, concluir lição, salvar plano) fica guardado só neste aparelho, para você testar o fluxo.
  - Uma faixa discreta no topo avisa: "Modo demonstração: seus dados ainda não são salvos".
  - Nenhum cálculo é inventado: todo número sai do motor da seção 7.
- **Na etapa de login:** as telas passam a ler e gravar no banco pelas funções já criadas, e o modo demonstração é removido.

## Telas
1. **Início (/)**: título, calculadora reduzida com resultado na página, "Como funciona" em 3 passos, "O que não fazemos" e aviso legal.
2. **Calculadora (/calculadora)**:
   - Campos da 9.2 e resultado no cenário central sem INSS.
   - Bloco "E se o INSS pagar algo?" mostrando as duas leituras lado a lado.
   - E-mail opcional com consentimento desmarcado.
   - "Montar meu plano em 21 dias" guarda os valores e leva ao onboarding.
3. **Entrar (/entrar)**: o visual pronto (e-mail e Google). Os botões só funcionam na etapa de login; por enquanto, um link leva ao onboarding.
4. **Onboarding**:
   - As 8 telas da 9.4, uma pergunta por vez, com barra de progresso e "Voltar".
   - Inclui a tela "Antes de tudo, vale cuidar disso" para quem tem dívidas em atraso.
   - Idade e renda já vêm preenchidas se a pessoa veio da calculadora.
5. **Hoje**:
   - Saudação, sequência semanal, nível e XP.
   - Bloco do dia (lição ou missão), lembrete do mês, os últimos 6 meses do fio e o resumo do plano.
6. **Lição (/programa/:dia)**:
   - 21 segmentos, conteúdo, fonte e data de revisão.
   - 3 perguntas com explicação e toasts de XP; ação do dia (meta, plano ou primeiro aporte).
   - Botão "Concluir dia N" e celebração no dia 21.
   - Conteúdo: as 21 lições e 63 perguntas da seção 10.
7. **Plano**:
   - Destaque do aporte necessário, alternância com/sem INSS e os três cenários.
   - Gráfico de área com texto alternativo e painel de premissas com "?".
   - "Como calculamos", revisão rápida, "Mudou algo na sua vida?", revisão anual, histórico e aviso fixo no rodapé.
8. **Diário**:
   - O fio da constância vertical (ipê, vazado, pontilhado) e a folha "Registrar aporte" com "Sim" ou "Não consegui".
   - A animação do ponto preenchendo, o detalhe do mês com editar e excluir, e o resumo com valores ocultos pelo botão de olho.
9. **Perfil**:
   - Trilha dos 5 níveis (4 e 5 "em breve") e conquistas.
   - Interruptor da reserva de emergência, lembretes e privacidade.
   - "Baixar meus dados" e "Excluir minha conta", que exige digitar EXCLUIR.
   - Links legais.
10. **Admin de conteúdo**:
    - Lista de lições com status e formulário completo da lição.
    - Editor das 3 perguntas com pré-visualização.
    - A regra de "publicada" só com revisor, data e fonte; CRUD de missões.

As regras de XP, sequência e níveis da seção 8 entram no modo demonstração exatamente como no banco (mesmos valores e limites), com testes.

## Detalhes técnicos
- **Conteúdo e regras:**
  - `src/content/program.ts` contém as lições e perguntas da §10, e `src/content/missions.ts` as missões da §11.
  - Também entram no banco por uma migração de seed com status 'rascunho', como o prompt 5 pede.
- **Camada de dados:** `src/lib/data/` com uma interface única (`getProgress`, `logContribution`, `completeLesson`, `savePlan`...).
  - Por enquanto, a implementação de demonstração usa localStorage.
  - Na etapa de login, ela é trocada pela versão Supabase (RPCs §6.1) sem mexer nas telas.
- **Gamificação de demonstração:** `src/lib/gamification/` replica as regras de §8/§6.1 (XP por ação, período único, pausa automática 1x/mês, níveis 1–3), com testes Vitest.
- **Rotas:** o gate de `_authenticated` fica desligado temporariamente, com um comentário claro; ele é religado na etapa de login.
- **Bibliotecas:** Recharts para o gráfico, react-hook-form + zod nos formulários e date-fns com pt-BR (fuso America/Sao_Paulo).
- **Atualizações:** `roadmap.md` e `AGENTS.md` (regra da camada de dados) são atualizados.
