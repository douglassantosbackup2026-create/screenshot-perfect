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
- Ligar em produção, nesta ordem: secrets do Mercado Pago, eventos do webhook, migration `20261102120000_assinatura_recorrente.sql`, e só então `VITE_BILLING_ENABLED=true`.
