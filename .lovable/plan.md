# Auditoria completa e preparação para produção

Sigo as 11 etapas do seu documento, em ordem. Corrijo os problemas no caminho e entrego um relatório final com parecer (Apto / Apto com ressalvas / Não apto).

## O que vou fazer

1. **Mapeamento** — inventário de todas as páginas (públicas, área logada, admin, afiliados, pagamento), integrações (Supabase, Mercado Pago) e banco (tabelas, permissões, funções).
2. **Testes funcionais** — percorrer cada página no navegador automatizado: botões, formulários, erros, recarregar página, acesso direto por URL, botão Voltar. Logado com conta de teste.
3. **Calculadora** — conferir as fórmulas contra cálculos independentes e criar testes para: sem patrimônio, sem aporte, rentabilidade zero, perto da aposentadoria, valores extremos, campos vazios/negativos.
4. **Banco** — conferir que cada pessoa só vê os próprios dados, que visitantes não acessam nada privado, e que pagamentos repetidos não creditam duas vezes.
5. **Segurança** — varredura de segurança, chaves expostas, entradas maliciosas, dependências vulneráveis, limite de abuso. Severidade: crítico/alto/médio/baixo.
6. **Telas** — capturas em 320, 375, 430, 768, 1024, 1366, 1440 e 1920 px; procurar cortes, rolagem lateral, contraste.
7. **Velocidade** — tamanho dos arquivos, erros no console, carregamento de fontes; otimizações seguras.
8. **Testes automáticos** — ampliar os testes e rodar tudo de novo após cada correção.
9. **Correções** — críticos e altos primeiro, mudanças localizadas, sem mudar visual nem regras financeiras sem explicar.
10. **Seis perfis de usuário** — jovem, meia-idade, perto de aposentar, pouca familiaridade, só celular, dados errados.
11. **Relatório** — salvo como documento para download, com checklist de produção.

## Regras que vou seguir

- Não mexo em dados reais; uso só uma conta de teste que crio e apago depois.
- Não publico nada.
- O que não der para testar aqui (pagamento real no Mercado Pago, e-mails chegando, métricas de campo como LCP real) fica marcado como **NÃO VALIDADO**, com instruções de como validar.

## Detalhes técnicos

- E2E com Playwright contra localhost; sessão de teste via `lovable auth-session`.
- Testes unitários em `src/lib/calc/` (Vitest), comparando com fórmulas de valor futuro de anuidade.
- Supabase: `security--run_security_scan`, linter, queries de RLS como `anon` e como outro usuário.
- Webhook do Mercado Pago testado com assinatura inválida e reenvio duplicado.
- Relatório em `/mnt/documents/auditoria-producao.md`.
- Trabalho longo: deve ocupar várias rodadas; aviso o progresso entre etapas.
