# Tirar "Continuar com Google"

- Telas **Criar conta** e **Entrar**: remover o botão "Continuar com Google" e a linha "ou / ou com e-mail" que o separa. Fica só e-mail e senha.
- Ajustar textos que citam Google: descrição da tela Entrar e o item da conta na página de Privacidade ("e-mail e senha").
- Quem já entrou com Google antes continua com a conta; só some o botão.

## Detalhes técnicos
- `src/routes/cadastro.tsx` e `src/routes/entrar.tsx`: apagar função `google()`, o `Button` e o divisor.
- `entrar.tsx` head e `privacidade.tsx` linha 15: tirar menção ao Google.
- Comentário em `verificar.tsx` ajustado.
