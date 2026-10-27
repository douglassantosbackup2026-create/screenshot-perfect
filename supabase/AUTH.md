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
