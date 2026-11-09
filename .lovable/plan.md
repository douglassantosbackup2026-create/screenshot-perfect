# Trocar "Mitikos" por "Planeja Fácil"

## O que muda para quem usa
- Nome do app em todos os títulos de página e prévias de compartilhamento ("Plano — Planeja Fácil").
- Textos da página inicial, boas-vindas, assinatura ("Assinar o Planeja Fácil") e Perfil.
- Ícone instalado no celular: nome "Planeja Fácil" (curto: "Planeja Fácil").
- Notificações passam a aparecer como "Planeja Fácil".
- Arquivo exportado: `meus-dados-planeja-facil.json`.
- WhatsApp: o código de conexão passa a ser `PLANEJA-XXXXXXXX`; códigos antigos `MITIKOS-...` continuam aceitos para quem já gerou um.

## O que fica igual (de propósito)
- Chaves internas guardadas no aparelho e nomes de cache — trocar desconectaria ou apagaria dados offline de quem já usa. Só o texto visível muda.
- Migrações antigas do banco (histórico, não aparece para ninguém).

## Detalhes técnicos
- `src/lib/seo.ts`: `APP_NAME = "Planeja Fácil"` (propaga para todos os `head()`).
- Textos: `WhatsAppSection.tsx`, `pillars.ts`, comentários, `SECURITY.md`, `supabase/AUTH.md`, `public/manifest.webmanifest`, título padrão em `public/sw.js`.
- `ErrorBoundary.tsx` e `perfil.tsx`: nome do arquivo exportado.
- WhatsApp: `link.functions.ts` gera `PLANEJA-`; `pipeline.ts` regex aceita `(planeja|mitikos)-`; teste novo em `pipeline.test.ts`.
- `e2e/app.spec.ts`: atualizar nomes e títulos esperados.
- Rodar `vitest` e conferir títulos com Playwright.
