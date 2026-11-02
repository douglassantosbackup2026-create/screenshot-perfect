# Auditoria de prontidão para produção

Data: 02/11/2026 · Base: commit `5e48309` + as alterações descritas aqui (ainda não commitadas).

## Como foi testado e o que não pôde ser testado

**Testado neste ambiente (Windows, Node, Chromium):**
- Vitest: testes unitários e de integração.
- **PGlite**: Postgres real em WebAssembly. As 35 migrations rodam em ordem, com o esquema `auth` e os papéis `anon`, `authenticated` e `service_role` do Supabase simulados, incluindo os privilégios padrão que o Supabase dá às tabelas.
- Playwright (Chromium, Pixel 7 e larguras de 320 a 1920 px) contra o servidor de desenvolvimento, com o Supabase simulado em `e2e/fake-supabase.ts`.
- `tsc`, `eslint`, build de produção e `npm audit`.

**NÃO validado, com o motivo:**

| Item | Motivo | Como validar |
|---|---|---|
| Banco de produção (RLS, dados reais) | Sem acesso ao projeto Supabase; sem Docker para o Supabase local | Aplicar as migrations pendentes num branch do Supabase e rodar as mesmas consultas de `src/test/rls.test.ts` no SQL Editor, com `set local role authenticated` e `set local request.jwt.claims` |
| Mercado Pago real (assinatura, cupom, preço, webhook) | Sem credenciais de sandbox aqui | Sandbox: assinar mensal e anual, com e sem cupom de 1 ciclo; conferir crédito, comissão e volta ao preço cheio |
| WhatsApp, push, Open Finance | Dependem de Meta, VAPID e provedor real (só existe o provedor mock) | Testes manuais com as credenciais |
| LCP e INP em produção | O build gera um Worker da Cloudflare; rodá-lo localmente exige `wrangler`, que não está instalado | PageSpeed Insights ou Lighthouse na URL publicada |
| Safari / iOS / Firefox | Só o Chromium está instalado | Teste manual num iPhone |
| Backups e restauração | Configuração do painel do Supabase | Checklist em `SECURITY.md` (PITR, restauração trimestral) |

## 1. Resumo executivo

O código está em bom estado:
- **O motor da calculadora está matematicamente correto.** Ele bate com uma implementação independente, mês a mês, em 200 cenários × 3 cenários de retorno × com e sem INSS, com erro de até R$ 0,01.
- Todas as 35 migrations aplicam num Postgres limpo e todas as tabelas têm RLS ligado.

A auditoria encontrou e corrigiu:
- **1 vulnerabilidade alta**: era possível trocar o próprio telefone do WhatsApp.
- **1 ponto alto de autorização**: admin com segundo fator ativo entrava sem o código.
- **2 falhas de validação na calculadora** que podiam mostrar "guarde R$ 0" ou aceitar valores inválidos.
- **1 erro visual no gráfico do plano**: o ponto do alvo citado na legenda não aparecia.
- **Rolagem horizontal em 320 e 375 px.**

Os principais riscos agora não estão no código. São validações que só podem ser feitas com acesso ao banco real e ao Mercado Pago (seção 8).

## 2. Inventário de funcionalidades

| Funcionalidade | Status | Testes executados | Resultado |
|---|---|---|---|
| Página inicial + calculadora rápida | Ativa | E2E: acesso direto, recarga, Voltar, valores positivos, negativos, vazios e extremos, 8 larguras | Aprovado após correções |
| Calculadora completa (`/calculadora`) | Ativa | E2E: patrimônio que já basta, campos vazios, negativos | Aprovado |
| Motor de aposentadoria (`retirement.ts`) | Ativo | 200 cenários contra a referência + perfis + validação (42 testes) | Aprovado após correções |
| Cadastro / login / esqueci senha / 2FA | Ativo | E2E: acesso e recarga das páginas. Fluxo real de auth **não validado** (Supabase simulado) | Parcial |
| Assinatura e paywall (`/planos`, `/pagamento`) | Ativo | E2E existentes: sem assinatura, vencida, falha fechada, volta do MP simulada | Aprovado (MP real não validado) |
| Plano (`/plano`) | Ativo | E2E: 3 perfis, salvar → recarregar, dado inválido não salva, ferramentas e detalhes | Aprovado após correções |
| Lançamentos, orçamento, contas, patrimônio, evolução, fechamento, perfil | Ativos | E2E: acesso direto e recarga sem erro no console; testes unitários de `lib/calc` (27 arquivos) | Aprovado |
| Navegação (menu de baixo, sub-abas, Voltar, 404) | Ativa | E2E: 4 áreas pelo menu, Voltar, rota inexistente | Aprovado após correções (320 px) |
| Afiliados (público, painel, admin) | Ativo | Banco (PGlite): comissão, código próprio recusado; E2E: acesso às páginas | Aprovado no banco; migration pendente em produção |
| Cupons e preços editáveis | Ativos | Banco: ciclos do cupom e uso único; preços só leitura; unitários de cobrança | Aprovado no banco; MP real não validado |
| Admin (conteúdo, usuários, funil, afiliados, cupons, preços) | Ativo | Banco: não-admin e anon recusados, MFA respeitado; E2E: bloqueio para não-admin | Aprovado após correção |
| WhatsApp, push, Open Finance | Atrás de flags | Unitários existentes; integrações reais **não validadas** | Não validado |
| Jornada (lições, revisão) | Desligada (`JOURNEY_ENABLED=false`, mantida de propósito) | Rotas redirecionam para `/hoje` | N/A |
| Modo claro/escuro | **Não existe**: tema escuro único por decisão de marca (AGENTS.md) | — | N/A |

## 3. Problemas encontrados

| # | Severidade | Problema | Causa | Impacto | Evidência |
|---|---|---|---|---|---|
| 1 | **Alta** | Usuário podia alterar `phone` e `verified_at` do próprio vínculo de WhatsApp | A policy de UPDATE da tabela + o privilégio padrão do Supabase na tabela inteira anulavam o `grant update (colunas)` | Ligar a conta ao número de outra pessoa: mensagens dela gravadas na conta do atacante | `rls.test.ts` falha sem a correção e passa com ela |
| 2 | **Alta** | Admin que ativou o segundo fator entrava nas funções de admin só com a senha | `20261108120000` trocou `is_admin()` para checar só o papel; as funções de admin passam por cima do RLS `_mfa_ok` | Senha vazada do admin abre e-mails, pagamentos, chaves Pix, preços e cupons | `rls.test.ts` (aal1 recusado com fator verificado) |
| 3 | Média | Calculadora aceitava idade fracionária que arredonda para 0 mês | Validação usava a idade, e a conta usa meses arredondados | Tela dizia "guarde R$ 0" mesmo havendo falta | Teste de validação |
| 4 | Média | `NaN`/`Infinity` passavam em patrimônio, aporte e INSS; inflação nunca era validada | Comparações `< 0` são falsas para NaN | Resultados sem sentido se o dado chegasse por outra via | Teste de validação |
| 5 | Média | Gráfico do plano não mostrava o ponto do alvo citado na legenda | O eixo Y ia só até o pico projetado | O usuário procura um ponto que não existe | Screenshot 1440 px antes e depois |
| 6 | Média | Rolagem horizontal em 320 px (`/diario`) e 375 px (`/patrimonio`) | Colunas do menu e das sub-abas não encolhiam; botões sem quebra de linha | Página "balança" para o lado no celular pequeno | E2E de tamanhos de tela |
| 7 | Média, defesa extra | Tabelas internas (afiliados, cupons, configurações, analytics…) e `plan_prices` mantinham insert/update/select padrão para anon e authenticated | Privilégios padrão do Supabase nunca revogados | Nenhum vazamento hoje (o RLS barra), mas uma policy errada no futuro exporia tudo | `rls.test.ts` |
| 8 | Média | Página inicial não mostrava as premissas junto do número | O texto só estava no rodapé | Resultado parecia promessa | E2E "positivo" |
| 9 | Baixa | `client-error` e `csp-report` liam o corpo inteiro antes de checar o tamanho | `request.text()` | Memória do Worker gasta por corpos enormes | `body.test.ts` |
| 10 | Baixa | `plan_snapshots` aceitava JSON sem limite | Sem check | Linhas gigantes | Migration |
| 11 | Baixa | GoalSeek recalculava até cerca de 780 simulações por tecla e não citava o INSS no texto | Usava o rascunho, não a cópia adiada | Digitação travando no plano | Revisão do código |
| 12 | Baixa | Renda digitada era reexibida arredondada (8.005 → 8.010) | `formatMonthly` | Pequena desconfiança | Revisão do código |
| 13 | Baixa | O que se digita nas páginas com SSR antes de o React assumir a página se perde | Comportamento padrão de SSR | Em rede lenta, o primeiro número digitado pode sumir | E2E (passa após `networkidle`) |
| 14 | Info | Eixos dos gráficos com ponto decimal ("1.8 mi") | `toFixed` | Padrão brasileiro é vírgula | — |

Itens apontados na leitura e **descartados** depois de checar:
- O `WhatIf` aplica a variação de retorno sobre a base de propósito, porque nenhum controle muda os retornos da variante.
- O `.env` versionado só tem a URL e a chave **publicável** do Supabase. É público por definição e é gerenciado pelo Lovable.

## 4. Correções implementadas

| Arquivo | Alteração | Justificativa |
|---|---|---|
| `supabase/migrations/20261112120000_auditoria.sql` (nova) | `is_admin()` = papel **e** `_mfa_ok()`; revoke de UPDATE em `whatsapp_links` e grant só nas colunas de preferência; revoke total de anon/authenticated nas tabelas internas; revoke de escrita em `plan_prices`; limite de 64 KB em `plan_snapshots` (NOT VALID) | Itens 1, 2, 7, 10. Nada apaga dados. Admin sem MFA continua entrando como antes |
| `src/lib/calc/retirement.ts` | `validateInputs` valida pelos meses arredondados; usa `Number.isFinite`; tetos de R$ 1 tri e 120 anos; inflação de −5% a 30%; mensagem de retorno uma vez só | Itens 3, 4. **Não muda nenhuma fórmula financeira**, só recusa entradas que antes produziam resultado errado |
| `src/routes/index.tsx` | Premissas junto do resultado; renda exibida sem arredondar | Itens 8, 12 |
| `src/routes/_authenticated/plano.tsx` | Eixo Y vai até o alvo; GoalSeek usa a cópia adiada | Itens 5, 11 |
| `src/components/plan/GoalSeek.tsx` | Texto cita o INSS quando ele entra na conta | Item 11 |
| `src/components/BottomNav.tsx`, `src/components/nav/areas.tsx`, `src/routes/_authenticated/diario.tsx`, `src/components/portfolio/PortfolioSection.tsx` | Colunas que encolhem, fonte menor abaixo de 360 px, quebra de linha nos grupos de botões | Item 6. Visual igual a partir de 360 px |
| `src/lib/security/body.ts` (novo) + rotas `client-error` e `csp-report` | Lê o corpo com limite de bytes | Item 9 |
| `src/lib/calc/format.ts` + 4 gráficos | `formatAxis` com vírgula | Item 14; remove 4 cópias da mesma lógica |
| `src/lib/auth/roles.ts`, `SECURITY.md` | Comentários e documentação alinhados à regra de MFA | Inconsistência entre as linhas 17 e 45 |
| `src/test/setup.ts` | Não toca em `window` fora do jsdom | Permite os testes de banco em ambiente node |
| `package.json` | Dev: `@electric-sql/pglite@0.5.10` (publicado há mais de 2 semanas) | Testes de RLS em Postgres real |

## 5. Resultados dos testes

| Suíte | Aprovados | Reprovados | Observação |
|---|---|---|---|
| Vitest, 57 arquivos | **488** | 0 | Eram 446 antes; +42 desta auditoria (referência financeira, validação, banco, leitor de corpo, formatação) |
| Banco, PGlite (`src/test/rls.test.ts`) | 18 | 0 | Sem a migration da auditoria, 4 falham: prova dos itens 1, 2 e 7 |
| Playwright, 2 arquivos | **61** | 0 | 19 existentes + 42 novos (`e2e/audit.spec.ts`) |
| `tsc --noEmit` | ok | — | |
| `eslint .` | 0 erros | — | 10 avisos de fast refresh, já existiam, só afetam o desenvolvimento |
| `npm run build` | ok | — | |
| Bloqueados ou não executados | — | — | Os da seção "NÃO validado" |

## 6. Segurança

**Corrigidas:** itens 1, 2, 7, 9 e 10.

**Confirmado nos testes de banco:**
- RLS ligado em todas as tabelas.
- Toda função SECURITY DEFINER fixa o `search_path`.
- Usuário A não lê nem altera dados de B.
- Anon não lê dados pessoais.
- Usuário comum e anon são recusados em todas as funções de admin.
- Ninguém se promove a admin.
- Com a cobrança ligada, só quem tem assinatura grava o próprio estado.

**Confirmado na revisão do código:**
- Sem `dangerouslySetInnerHTML` nem HTML vindo do usuário.
- Webhooks com HMAC e comparação em tempo constante.
- Sem segredos nos arquivos versionados.

**Pendentes (não corrigidas, com o motivo):**

| Item | Severidade | Motivo |
|---|---|---|
| `npm audit`: `vite` 8.1.5 (alta) | Baixa na prática | Afeta só o servidor de desenvolvimento, não o Worker em produção. A versão vem da configuração do Lovable; forçar a atualização pode quebrar a sincronização. **O passo `npm audit --audit-level=high` do CI falha por isso** |
| `npm audit`: `zod` 3.25 (alta, memória com coleções enormes) | Baixa na prática | Só valida listas no webhook do WhatsApp, depois da assinatura da Meta e com limite de 256 KB. Zod 4 é uma mudança incompatível |
| CSP completa ainda em Report-Only | Média | Já é a estratégia do projeto: impor depois de analisar os relatórios de `/api/public/csp-report` |
| Limite de taxa deixa passar se o banco falhar | Baixa | Decisão consciente: só o código do WhatsApp falha fechado |
| `user_state` gravado pelo cliente (XP controlado pelo cliente) | Baixa | Interino, documentado no AGENTS.md; cobrança e acesso não dependem dele |

## 7. Performance

**Medido no build de produção** (tamanho do JS, gzip nível 9):
- Página inicial: cerca de 154 KB (`index`) + 55 KB (cliente Supabase) + o pedaço da rota. **Não carrega o recharts.**
- Recharts: 98 KB, carregado só nas telas com gráfico.
- Total de todas as rotas: 573 KB em 115 arquivos, divididos por rota.

**Não medido:** LCP, INP e CLS no ambiente de produção (ver o topo do documento).

**Melhoria feita:** GoalSeek com a cópia adiada (item 11). Não encontrei outra otimização segura com ganho claro sem medir em produção.

**Contraste WCAG**, calculado a partir dos tokens de `src/styles.css`: todos os pares de texto passam no nível AA. O mínimo é 6,39:1, texto secundário sobre fundo `muted`.

## 8. Pendências

1. **Aplicar no Supabase, em ordem:** `20261109120000_afiliados`, `20261110120000_cupons`, `20261111120000_precos`, `20261112120000_auditoria`.
2. **Validar o Mercado Pago no sandbox**: assinatura mensal e anual, cupom de 1 ciclo com volta ao preço cheio, mudança de preço sem afetar quem já assina.
3. **Conferir no projeto real os privilégios padrão das tabelas** (`\dp public.whatsapp_links`). O item 1 depende deles.
4. **Medir LCP e INP na URL publicada.**
5. **Testar num iPhone (Safari).**
6. **Revisar a falha do CI no `npm audit`**: subir o vite quando o Lovable permitir, ou ajustar o nível do passo.
7. **Fazer a checklist do painel em `SECURITY.md`**: PITR, teste de restauração, SMTP próprio, Redirect URLs.

## 9. Checklist de produção

- [x] Todas as funcionalidades críticas foram testadas. *Parcial*: o pagamento real e o banco real não foram (seção 8).
- [x] A calculadora apresenta resultados matematicamente corretos.
- [x] Não existem bugs críticos conhecidos.
- [x] Não existem vulnerabilidades críticas conhecidas. As altas encontradas foram corrigidas no repositório, **mas só valem em produção depois de aplicar a migration**.
- [x] A aplicação funciona nos principais tamanhos de tela, de 320 a 1920 px, no Chromium.
- [ ] O banco de dados está corretamente configurado. **Não verificável daqui**; 4 migrations pendentes.
- [x] O build de produção é concluído sem erros.
- [x] Os principais fluxos end-to-end foram aprovados, com Supabase simulado.
- [x] Erros são tratados adequadamente: sem erro de console em nenhuma rota testada; mensagens de validação visíveis.
- [ ] Os dados dos usuários estão protegidos. Garantido no código e no Postgres de teste; **em produção, depende do item 1 da seção 8**.
- [ ] Existe uma estratégia de recuperação em caso de falhas. Documentada em `SECURITY.md`, mas **a execução (PITR, teste de restauração) não foi confirmada**.
- [ ] A aplicação está preparada para receber usuários reais.

## 10. Parecer final

**NÃO APTO PARA PRODUÇÃO**, por ora. Depois das pendências 1 a 3 da seção 8, passa a **APTO COM RESSALVAS**.

Justificativa:
- Não há bloqueio conhecido no **código**. O motor financeiro foi validado de forma independente, as falhas de segurança e de interface encontradas foram corrigidas e toda a suíte passa.
- Mas pela régua pedida, funcionalidades essenciais sem validação impedem o "apto":
  - a **cobrança no Mercado Pago** não foi testada de verdade;
  - as **correções de segurança** só protegem o banco real depois que a migration for aplicada;
  - os **privilégios do projeto real** não puderam ser conferidos.
- Essas três validações levam poucas horas e não exigem mudança de código.
