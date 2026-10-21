# Pagamento do Premium com Mercado Pago

## Observação sobre a lista "O que falta para ir ao ar"
A lista fala de um trabalho que não está neste projeto (branch `feature/supabase`, `.env.example`, `/redefinir-senha`, Mercado Pago). Se esse código existir no GitHub, junte a branch ao `main` antes; senão, construo aqui do zero, como abaixo.

## O que a pessoa vai ver
1. Na página de vendas e no Perfil, o botão "Assinar Premium" (mensal R$ 29,90 ou anual R$ 239,90) substitui o "Em breve".
2. Ao clicar, ela vai para o checkout do Mercado Pago (cartão, Pix ou boleto).
3. Ao voltar, vê "Pagamento confirmado" ou "Aguardando confirmação" (Pix/boleto).
4. Quando o Mercado Pago confirma, o Premium é liberado até a data de validade, visível no Perfil.
5. Um interruptor deixa a cobrança desligada até você decidir abrir as vendas.

## Pré-requisitos
- Login funcionando (o pagamento precisa estar ligado a uma conta). Faço essa etapa primeiro (roadmap passo 4).
- Você cria uma conta de vendedor no Mercado Pago e me passa, pelo formulário seguro, o Access Token e a chave secreta do webhook.

## Decisão a confirmar
- Começar com **pagamento único por período** (mensal ou anual, renovação manual, aceita Pix). Assinatura com cobrança automática no cartão fica para depois.

## Detalhes técnicos
- Servidor cria a preferência do Checkout Pro (`createServerFn` autenticado), com `external_reference` = id do usuário + plano + período.
- Rota pública `src/routes/api/public/mercadopago/webhook.ts`: valida a assinatura `x-signature` com o segredo, busca o pagamento na API do Mercado Pago (nunca confia no corpo), e se `approved` chama a RPC existente `credit_payment` (idempotente pelo id do pagamento) que grava `payments` e estende `entitlements`.
- Preços vêm de `src/content/pricing.ts`; cálculo da validade em função pura com teste.
- Segredos: `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`; `VITE_BILLING_ENABLED` liga os botões.
- Testes: validade (30/365 dias, soma ao período vigente), assinatura do webhook, pagamento repetido não credita duas vezes.
- Adiciono a tarefa ao roadmap ao começar.
