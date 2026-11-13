# Gerentes de parceiros

## O que muda para você (admin)
- No painel **Admin → Parceiros** aparece uma nova aba **Gerentes**.
- Você cria um gerente com nome, e-mail, WhatsApp, chave Pix e a **% extra** que ele ganha.
- Em cada parceiro aparece um campo **Gerente** para escolher a quem ele pertence (ou nenhum).
- Na tela de comissões, as comissões de gerente aparecem junto, marcadas como "Gerente", e você marca como pagas do mesmo jeito.

## O que o gerente vê
O gerente entra com o e-mail cadastrado e ganha a área **/gerente** com:
- Lista dos seus parceiros (nome, situação, quantas pessoas cada um indicou).
- Vendas e comissões de cada parceiro, e o total que o gerente tem a receber e já recebeu.
- **Link de convite próprio**: quem se inscreve como parceiro por esse link já entra ligado a ele (você ainda aprova a inscrição).

## Como a comissão funciona
Quando alguém indicado por um parceiro paga, o parceiro recebe a comissão dele como hoje, e o gerente recebe a sua % extra sobre o mesmo pagamento, pelo mesmo prazo (meses) do parceiro. A comissão do parceiro não diminui.

## Detalhes técnicos
- Migration: tabela `affiliate_managers` (nome, email, whatsapp, pix, commission_bp, code de convite, ativo) sem acesso direto do cliente; coluna `affiliates.manager_id`; coluna `affiliate_commissions.manager_id` + `kind` ('parceiro'|'gerente').
- Trigger `_affiliate_commission` estendido: ao gerar comissão de parceiro com gerente ativo, insere segunda linha para o gerente com `commission_bp` do gerente.
- RPCs security definer: `admin_list_managers`, `admin_save_manager`, `admin_set_affiliate_manager`, `my_manager()` (pelo e-mail confirmado, como `my_affiliate`). `admin_affiliate_commissions` passa a incluir as de gerente.
- Inscrição em /parceiros aceita `?gerente=CODIGO` e grava `manager_id`.
- Telas: aba no admin, rota `_authenticated/gerente.tsx`.
- Cálculo da % extra em função pura em `src/lib/calc/` com teste (ex.: pagamento R$ 100, 5% → R$ 5); teste de RLS garantindo que gerente só vê os próprios parceiros.
