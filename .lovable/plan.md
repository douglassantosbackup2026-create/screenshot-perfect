# O que falta para ir ao ar

Hoje o app funciona inteiro em modo demonstração: os dados ficam só no aparelho e ninguém consegue criar conta. O pagamento já está pronto, mas os botões estão desligados.

## Obrigatório (nesta ordem)
1. **Login de verdade.** Entrar por link no e-mail (e Google, se você quiser), religar o bloqueio das telas do app e salvar tudo no banco em vez de no aparelho. É a maior etapa.
2. **Conteúdo no banco.** Gravar as 21 lições, as 63 perguntas, as missões e os desafios. Só publicar depois que alguém revisar e indicar quem revisou, a data e a fonte (regra do próprio app). Sem isso, a Jornada fica vazia para quem tem conta.
3. **Excluir conta.** Hoje a exclusão é só simulada; precisa apagar os dados de verdade (exigência da LGPD).
4. **Publicar** o app e cadastrar o endereço publicado no Supabase (Authentication → URL Configuration), para os links de login funcionarem.
5. **Mercado Pago.** Cadastrar o endereço de avisos de pagamento no painel do Mercado Pago, fazer um pagamento de teste e depois ligar os botões de assinatura.
6. **Teste completo com uma conta real:** criar a conta, fazer o onboarding, uma lição, um registro, um pagamento de teste, sair, entrar de novo e conferir que os dados continuam lá.

## Pode vir logo depois
- Lembretes por e-mail (precisa de um domínio seu para enviar).
- Medição de uso (analytics), só com o consentimento da pessoa.
- Revisar os textos que eu escrevi (página de vendas, perguntas frequentes) e definir o preço anual do Pro.

## Sugestão
Começo agora pela etapa 1 e sigo para as etapas 2, 3 e 6. As etapas 4 e 5 precisam de um clique seu (publicar e configurar o painel do Mercado Pago); eu aviso a hora certa.
