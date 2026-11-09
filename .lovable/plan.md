# Botões "Abrir o app" levam ao próximo bloco da página

Hoje, para quem já tem conta mas não assinou, "Abrir o app" e "Ver a conta completa" abrem a tela de assinatura. Com a mudança, eles rolam a página até o bloco seguinte, sem sair dela.

## Cada botão
- "Abrir o app" logo abaixo do título: rola até a calculadora rápida.
- "Abrir o app" da calculadora: rola até "3 apps em 1".
- "Ver a conta completa": rola até "3 apps em 1" também (fica no mesmo cartão).
- "Abrir o app" do final ("Comece hoje"): não há bloco depois dele, então rola até os planos e preços.
- "Abrir o app" do topo da página: continua abrindo o app (é o atalho para quem já usa). Me avise se quiser que ele role também.

## O que não muda
- Para quem não tem conta, "Assinar" e "Montar meu plano" seguem para o cadastro.
- O botão dos planos segue para o cadastro/assinatura.

## Detalhes técnicos
- `src/routes/index.tsx`: ids nas seções (`calculadora-rapida`, `tres-em-um`, `planos`); helper `scrollToId` com `scrollIntoView({ behavior: "smooth" })`; quando `signedIn`, os botões chamam o scroll em vez de `start()`; "Ver a conta completa" vira botão de rolagem.
- `ThreeInOne` e `Pricing` em `sections.tsx` recebem `id`.
- Verificar com Playwright que cada clique rola até o bloco certo.
