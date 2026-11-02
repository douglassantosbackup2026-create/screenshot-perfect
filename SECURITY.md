# Segurança do Mitikos

O que o código já garante, o que precisa ser configurado nos painéis (Supabase, Lovable/Cloudflare, GitHub) e as rotinas de operação. Mudou uma proteção? Atualize aqui.

## Escopo financeiro

O app **não movimenta dinheiro**: não há PIX, saque nem transferência entre pessoas. "Transferência" é só um par de lançamentos entre contas da própria pessoa. O único dinheiro real é a assinatura, cobrada pelo Mercado Pago. Se PIX ou pagamentos entre pessoas entrarem no produto, desenhar antes: saldo validado no banco, idempotência por chave, limites por conta, confirmação extra e antifraude.

## O que o código garante

| Ameaça | Defesa | Onde |
|---|---|---|
| Manipulação de preço/plano | Preço só no servidor; webhook relê o pagamento na API do MP e confere valor, moeda e referência | `src/lib/billing/`, rota `mercadopago/webhook` |
| Pagamento duplicado / replay | `credit_payment` idempotente pelo id do pagamento; `webhook_receipts` por `x-request-id`; janela de 5 min na assinatura HMAC | migrations `assinaturas`, `security_hardening_2` |
| Status de assinatura fora de ordem | `apply_subscription_status` só grava evento mais novo (`last_event_at`) | `security_hardening_2` |
| Acesso a dados de outra pessoa | RLS em todas as tabelas; gatilhos conferem dono de conta/categoria/transferência/recorrência/aporte | migrations |
| Escalação de privilégio | Papéis em `user_roles` (cliente só lê); `has_role` só responde sobre a própria conta; admin não exige MFA (decisão de produto) | `security_hardening_2`, `admin_sem_mfa` |
| Account takeover | MFA TOTP opcional para todos, inclusive admin; com MFA ativo, o banco esconde os dados sem `aal2`; excluir conta exige senha recente (+ código) | `src/lib/auth/mfa.ts`, `_mfa_ok`, `_recent_auth` |
| Brute force / abuso | Limite por IP, usuário e número em `hit_rate_limit` (rotas públicas, server functions, código do WhatsApp, leads, analytics) | `src/lib/security/rate-limit.server.ts` |
| Enumeração de e-mail | `submit_lead` responde igual para e-mail novo ou repetido | `security_hardening_2` |
| Comparação de segredos | Tempo constante (`secretMatches`) no cron, Open Finance e WhatsApp | `src/lib/security/compare.ts` |
| SSRF | Push só para serviços de push conhecidos (check no banco + allowlist no envio, sem seguir redirect) | `src/lib/push/endpoint.ts` |
| XSS | Sem `dangerouslySetInnerHTML`; fontes de lição só `https://` (banco e tela); CSP (parte imposta, parte em Report-Only com relatório) | `content-rules.ts`, `security-headers.ts` |
| Clickjacking / sniffing | `frame-ancestors`, `nosniff`, HSTS com preload, `Referrer-Policy`, `Permissions-Policy` | `src/lib/security-headers.ts` |
| CSRF | Server functions exigem token Bearer (não usam cookie) + middleware CSRF; webhooks autenticados por assinatura | `src/start.ts` |
| SQL injection / RCE | Só query builder e RPCs; nenhum SQL dinâmico, `eval` ou processo filho; curingas do `ilike` escapados | — |
| Abuso administrativo | Toda ação de admin e mudança de conteúdo, papel e configuração vai para `audit_log` (somente inserção) | `security_hardening_2` |
| Farm de XP | Tetos mensais no banco (metas concluídas, orçamento só mês atual/seguinte, missão sem resposta repetida) | `security_hardening_2` |
| Vazamento de detalhes internos | Erros do banco só no log; respostas genéricas | rotas `api/` |

`audit_log` não aceita `update`, `delete` nem `truncate`. Linhas com mais de 5 anos só saem por `purge_expired()`. Severidade `high`: pagamento recusado por valor/referência, mudança de papel ou de `app_settings`.

## Configurar nos painéis (não é código)

**Supabase → Authentication**
- [ ] Leaked password protection (HIBP) **ligado**.
- [ ] Senha mínima 8, exigindo letras e dígitos (igual a `passwordProblems`).
- [ ] MFA → TOTP **habilitado**.
- [ ] Refresh token rotation ligado, com reuse interval curto (detecção de reuso).
- [ ] JWT expiry de 3600 s ou menos.
- [ ] SMTP próprio com SPF, DKIM e DMARC no domínio (e-mails de login confiáveis, contra phishing).
- [ ] URL Configuration: só os domínios do app em Redirect URLs.
- [ ] Captcha (Turnstile): adiado por decisão. Ligar se aparecer ataque de credenciais.

**Antes do deploy desta versão:** o admin precisa ativar a verificação em duas etapas em Perfil. Sem ela, o back-office não abre.

**Supabase → Database / Backups**
- [ ] PITR ligado (backups criptografados em repouso, AES-256, pelo Supabase).
- [ ] Teste de restauração **trimestral**: restaurar num branch/projeto separado, conferir contagem de `user_state`, `payments`, `entitlements`, `subscriptions` e `audit_log`, abrir o app apontando para ele e anotar a data aqui.
- [ ] Advisors (Security e Performance) revisados todo mês.
- [ ] Query performance / logs: revisar consultas lentas ou volume anormal por `anon`.

**Ambientes e segredos**
- Produção e testes em projetos Supabase separados; nunca usar a service role de produção fora do servidor.
- Segredos só nas variáveis do servidor (Lovable Cloud). Nada de segredo com prefixo `VITE_`: isso vai para o navegador.
- Rotação semestral (e imediata se houver suspeita): `SUPABASE_SERVICE_ROLE_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `OPEN_FINANCE_WEBHOOK_SECRET`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`.

**Hospedagem (Lovable / Cloudflare)**
- TLS 1.2+ e proteção DDoS/WAF são da plataforma. Não há API Gateway próprio: limites e validação ficam na aplicação e no banco.
- Para submeter o domínio ao HSTS preload (hstspreload.org), o domínio próprio precisa servir HTTPS em todos os subdomínios.

**GitHub**
- CI (`.github/workflows/ci.yml`): tipos, lint, testes, gitleaks e `npm audit`.
- Dependabot semanal (`.github/dependabot.yml`).
- Proteção do branch `main`: exigir CI verde.

## Rotinas

| Quando | O quê |
|---|---|
| Diário (cron) | `purge_expired()`: códigos vencidos, limites de taxa, mensagens WhatsApp > 90 d, recibos de webhook > 30 d, lembretes > 180 d, analytics > 13 meses, leads > 24 meses, auditoria > 5 anos |
| Semanal | Ver `audit_log` com `severity in ('warning','high')`; PRs do Dependabot |
| Mensal | Advisors do Supabase; logs `[csp]` (quando só sobrarem scripts inline do SSR, passar a CSP para nonce e impor `script-src`) |
| Trimestral | Teste de restauração de backup |
| Semestral | Rotação de segredos |

## Pendências conhecidas

- `npm audit` acusa vulnerabilidades altas em **vite** (servidor de desenvolvimento; correção em 8.3.x, fora da faixa do `@lovable.dev/vite-tanstack-config`) e em **zod 3** (correção só no zod 4, mudança incompatível). O CI avisa sem bloquear até a migração.
- `user_state` (jsonb) é escrito pelo cliente: são dados da própria pessoa e não decidem cobrança, XP do servidor nem permissões. A troca pelas tabelas normalizadas segue planejada à parte.
- CSP completa ainda em Report-Only (os scripts inline do SSR precisam de nonce).

## Incidente

1. Conter: revogar sessões (Supabase → Users → sign out), rotacionar o segredo afetado e, se preciso, ligar `app_settings.billing_enforced` ou desligar integrações (`WHATSAPP_*`, `OPEN_FINANCE_PROVIDER`).
2. Investigar: `audit_log`, logs do Worker e do Supabase.
3. Comunicar: titulares e ANPD em até 3 dias úteis quando houver risco relevante (LGPD, art. 48).
4. Registrar aqui o que mudou.
