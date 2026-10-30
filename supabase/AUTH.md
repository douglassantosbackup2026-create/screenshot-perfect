# Auth — URL Configuration (manual)

Projeto: `nzhzmuhjdqcdjoltrsik`  
Dashboard: https://supabase.com/dashboard/project/nzhzmuhjdqcdjoltrsik/auth/url-configuration

## Site URL

Use a origem pública do app (produção). Exemplos:

- Domínio próprio: `https://seu-dominio.com`
- Preview Lovable: `https://<projeto>.lovable.app`

## Redirect URLs

Inclua todas as origens usadas (produção + preview), com estes paths:

- `{ORIGIN}/entrar`
- `{ORIGIN}/redefinir-senha`
- `{ORIGIN}/cadastro` (se o fluxo de confirmação voltar para cá)

Wildcards úteis em preview:

- `https://*.lovable.app/**`
- `https://*.lovableproject.com/**`

O app já redireciona reset de senha para `/redefinir-senha` (`src/routes/esqueci-senha.tsx`).

## Segurança recomendada

Em **Authentication → Providers → Email** / Password security:

- Ativar **Leaked password protection** (Have I Been Pwned) — ainda desligado no advisor do projeto.

## Variáveis do host (fora do painel Auth)

Cliente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`  
Servidor: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`  
Billing: `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `VITE_BILLING_ENABLED`

URL da API: `https://nzhzmuhjdqcdjoltrsik.supabase.co`

## Assinatura (não existe plano grátis)

- Com `VITE_BILLING_ENABLED=true`, só entra no app quem tem assinatura válida em `entitlements`. Sem assinatura, abrem apenas `/planos` (Assinatura) e `/perfil` (exportar dados, excluir conta, sair). Admin entra sempre. Sem a variável, o app fica aberto para todos.
- A assinatura é recorrente no Mercado Pago (preapproval), só no cartão de crédito. `src/lib/billing/subscription.functions.ts` cria e cancela; excluir a conta cancela a assinatura antes.
- Webhook: `POST /api/public/mercadopago/webhook`. No painel do Mercado Pago (Suas integrações → Webhooks), ligar os eventos **Pagamentos**, **Planos e assinaturas** (`subscription_preapproval`) e **Pagamentos recorrentes** (`subscription_authorized_payment`), e copiar a assinatura secreta para `MERCADO_PAGO_WEBHOOK_SECRET`.
- Cada cobrança aprovada chama `credit_payment` (31 ou 366 dias somados à validade, uma vez por pagamento). O status da assinatura fica em `subscriptions`. A decisão de cada evento está em `src/lib/billing/webhook.ts`, com testes.
- Ligar em produção, nesta ordem: secrets do Mercado Pago, eventos do webhook, migrations `20261102120000_assinatura_recorrente.sql` e `20261103120000_assinatura_no_banco.sql`, `VITE_BILLING_ENABLED=true` e, por último, a trava no banco: `update public.app_settings set billing_enforced = true;` (sem ela, quem não assina ainda grava pela API).

## WhatsApp (Cloud API da Meta)

- Webhook: `GET/POST /api/public/whatsapp/webhook`. No app da Meta (produto WhatsApp → Configuração), use essa URL, o mesmo `WHATSAPP_VERIFY_TOKEN` e assine o campo `messages`.
- Segredos do servidor: `WHATSAPP_TOKEN` (token permanente de usuário do sistema), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (confere a assinatura `X-Hub-Signature-256`), `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_DISPLAY_NUMBER` (o número com DDI, para o link wa.me) e, opcional, `WHATSAPP_GRAPH_VERSION`.
- No app: `VITE_WHATSAPP_ENABLED=true` mostra Perfil › WhatsApp. A pessoa gera um código (vale 10 min) e manda `MITIKOS-XXXXXX` para o número; o webhook liga o número à conta (`whatsapp_links`).
- Migration `20261105120000_whatsapp.sql`. Mensagens não são guardadas, só o id (`whatsapp_messages`) para não lançar duas vezes.
- O lançamento é gravado em `user_state` com as mesmas funções do app (`addTransactionTo`, `deleteTransactionIn`, `updateTransactionIn` em `src/lib/data/demo-store.ts`) e a mesma conferência de `updated_at`. O app recarrega ao voltar para a aba.
- Teste local sem a Meta: `WHATSAPP_APP_SECRET=... node scripts/whatsapp-sim.mjs 5511999990000 "gastei 62 na farmácia"` com `npm run dev` rodando.
