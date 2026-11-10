# Open Finance com Pluggy

Cada pessoa conecta o próprio banco dentro do app. Com isso o app traz saldo, extrato, previdência e investimentos, e reconhece os aportes do mês.

## O que a pessoa vê
1. Em Perfil: "Conectar meu banco". Abre a janela da Pluggy, onde ela escolhe o banco e autoriza.
2. Em Lançamentos: o extrato aparece sozinho. Os aportes de previdência que o app reconhece chegam como "Aporte sugerido", e ela confirma com um toque. O app nunca registra um aporte sem a confirmação dela.
3. Em Plano: os saldos de PGBL, VGBL e investimentos aparecem como "patrimônio atual", com a data da última atualização.
4. Em Perfil: lista dos bancos conectados, com os botões "Atualizar" e "Desconectar". Desconectar apaga os dados que vieram daquele banco.
5. Antes de conectar, um aviso claro sobre quais dados o app lê e para quê (LGPD).

## O que você precisa fazer
- Criar uma conta em dashboard.pluggy.ai e copiar o Client ID e o Client Secret. Eu peço os dois de forma segura.
- Começar no modo de testes da Pluggy, com bancos de mentira. Para usar com bancos reais é preciso pedir a liberação de produção à Pluggy, que é paga.
- Cadastrar o endereço de avisos que eu crio no painel da Pluggy.

## Detalhes técnicos
- Secrets `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`, usados só no servidor.
- Server functions autenticadas: `createConnectToken` (connect token da Pluggy ligado ao userId), `syncItem` e `deleteItem`.
- Widget `react-pluggy-connect`, carregado só no navegador (lazy, atrás de ClientOnly).
- Webhook em `src/routes/api/public/pluggy/webhook.ts` para os eventos item/updated e transactions/created. Ele não confia no corpo da mensagem: busca os dados de novo na API da Pluggy e confere se o item pertence a algum usuário.
- Tabelas novas com RLS (dono = auth.uid()): `bank_connections`, `bank_accounts`, `bank_transactions`, `investments`. Tudo é apagado quando a conta é excluída.
- A regra que reconhece um aporte (categoria e descrição de previdência ou investimento, saída de dinheiro) fica como função pura em `src/lib/calc/` ou `src/lib/openfinance/`, com testes. O patrimônio atual entra no cálculo pelas funções de `src/lib/calc/`.
- Valores bancários ficam fora das métricas de uso e de qualquer compartilhamento.
