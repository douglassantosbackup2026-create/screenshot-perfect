# Trocar "afiliado" por "parceiro"

## O que muda para quem usa
- Todo texto visível passa de "afiliado(s)" para "parceiro(s)": página pública de inscrição, área do parceiro, rodapé/links, cadastro, perfil, página inicial e painel admin (aba, cupons, usuários).
- Endereços novos: `/parceiros` (inscrição) e `/parceiro` (área do parceiro), `/admin/parceiros` no painel.
- Endereços antigos (`/afiliados`, `/afiliado`, `/admin/afiliados`) continuam funcionando e redirecionam para os novos — links já divulgados não quebram.
- Links de indicação com código (`?ref=`) seguem iguais; comissões e cupons não mudam.

## Detalhes técnicos
- Renomear os arquivos de rota e criar rotas antigas só com `redirect`.
- Atualizar `Link`/`navigate` e textos nos ~18 arquivos encontrados; títulos e descrições de SEO das páginas renomeadas.
- Nomes internos (tabelas `affiliates`, funções, pasta `src/lib/affiliates`, eventos de analytics) ficam iguais para não quebrar dados e histórico.
- Rodar os testes existentes.
