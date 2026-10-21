# Análise: "O que falta para ir ao ar"

## Conclusão principal
A lista descreve um trabalho que **não está neste projeto do Lovable**. Aqui ainda não existem:
- página `/redefinir-senha` (login ainda é só visual, modo demonstração);
- arquivo `.env.example`, lembretes por e-mail, PostHog, Mercado Pago, `VITE_BILLING_ENABLED`;
- a branch `feature/supabase` (o Lovable só enxerga `main`).

Ou seja, os 12 commits foram feitos fora do Lovable (localmente ou em outra ferramenta). Enquanto não forem juntados ao `main` no GitHub, nada da lista se aplica aqui.

## Item a item
1. **Juntar branch ao main** — correto e é o passo 1. Feito no GitHub (pull request `feature/supabase` → `main`). Depois disso o Lovable puxa o código sozinho. Atenção: o `main` recebeu mudanças pelo Lovable depois (página de vendas, etc.); pode haver conflitos.
2. **Publicar lições/missões/desafios** — correto, mas antes de publicar o conteúdo precisa estar no banco (seed) e, pelas regras do app, ter revisor, data e fonte. Publicar tudo direto pula essa revisão profissional.
3. **Chaves** — `VITE_POSTHOG_KEY` não precisa ser secreta; e-mails: recomendo o e-mail próprio do Lovable em vez de Resend (sem chave). `CRON_SECRET` deve ser gerado automaticamente.
4. **Lembretes via GitHub** — funciona, mas é frágil; dá para fazer o agendamento direto no banco.
5. **Endereços de retorno do login** — correto; precisa do endereço publicado (ainda não publicado).
6. **Regenerar types.ts** — automático no Lovable após mudanças no banco.
7. **Teste com conta real** — correto e indispensável.
8. **Cobrança Mercado Pago** — o Lovable tem pagamentos próprios (Stripe/Paddle) sem chave; Mercado Pago só se você preferir (Pix).

## Próximo passo sugerido
Você junta a branch no GitHub e me avisa. Eu então: confiro conflitos e erros, rodo os testes, coloco o conteúdo no banco, configuro e-mails e chaves e faço o teste completo com uma conta real.
