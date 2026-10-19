# Etapa 4 — Login e onboarding (spec §9.3, §9.4)

## Entrar (`/entrar`)
- Campo de e-mail: "Entre com seu e-mail. Enviamos um link de acesso." Após enviar, mostra "Confira seu e-mail" com o endereço usado.
- Botão "Continuar com Google".
- Depois do login: se o onboarding não foi concluído, vai para `/onboarding`; senão, para `/hoje`. Quem já está logado e abre `/entrar` segue direto.
- Botão "Sair" disponível no Perfil (temporário até a etapa 9).

## Onboarding (`/onboarding`)
Uma pergunta por tela, barra de progresso no topo, botão "Voltar" sempre visível:
1. Nome
2. Ano de nascimento (mostra a idade calculada)
3. Tipo de trabalho: PJ, autônomo, MEI, CLT, servidor público, outro
4. Idade para se aposentar: seletor 45–75, padrão 60
5. Renda mensal desejada em reais de hoje, com a dica "Um bom ponto de partida é a sua renda atual."
6. Dívidas em atraso: Sim / Não / Prefiro não dizer. Se "Sim", tela "Antes de tudo, vale cuidar disso" com três orientações e os botões "Continuar para o programa" e "Ver dicas para organizar dívidas" (abre as dicas na própria tela, sem bloquear)
7. Dia do mês em que o dinheiro entra (1–28) e opção de lembrete semanal
8. "Seu programa de 21 dias começa hoje." — botão "Começar dia 1" leva a `/programa/1`

- Se a pessoa veio da calculadora, idade e renda chegam pré-preenchidas.
- Ao concluir, grava no perfil: nome, ano, tipo de trabalho, dívidas, dia do lembrete, lembrete semanal e data de conclusão.
- Idade de aposentadoria e renda desejada ficam guardadas no aparelho para pré-preencher o plano no dia 14 (o perfil não tem esses campos no §6.1).

## O que você precisa fazer no Supabase
- Authentication → URL Configuration: adicionar o endereço do preview e o publicado em Redirect URLs.
- Authentication → Providers → Google: ativar com Client ID e Secret do Google Cloud (passo a passo enviado ao final).
- Testar o Google numa aba nova, fora do editor.

## Detalhes técnicos
- `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: origin + "/entrar" } })` e `signInWithOAuth({ provider: "google", redirectTo: origin + "/entrar" })`; `/entrar` detecta a sessão e redireciona conforme `profiles.onboarding_completed_at`.
- Listener único `onAuthStateChange` no `__root` (SIGNED_IN/SIGNED_OUT/USER_UPDATED) com `router.invalidate()`.
- Onboarding com react-hook-form + zod; atualização via cliente Supabase (RLS: só o próprio perfil).
- Chaves de sessionStorage da calculadora: `calc_prefill` `{ currentAge, retirementAge, desiredIncome }`; prefill do plano em localStorage `onboarding_goal`.
- Teste: validação do ano de nascimento (1930–2015) e da faixa de idade 45–75.
