# Consertar a inscrição de afiliados

## O que aconteceu
Toda inscrição de afiliado está falhando, para qualquer pessoa. As 3 primeiras tentativas da Thais deram erro ao salvar ("Não foi possível enviar agora"). Na 4ª, ela bateu no limite de 3 tentativas por e-mail por dia e viu "Muitas tentativas". Nenhuma inscrição foi salva até agora.

Causa: por padrão, a comissão de uma inscrição nova é "por X meses", mas a quantidade de meses fica vazia. O banco recusa esse cadastro.

## Correção
- Inscrição nova entra com comissão de **12 meses**, o mesmo padrão que o painel de admin já usa. Você continua mudando isso por afiliado ao aprovar.
- Zerar o contador de tentativas da Thais (e-mail e conexão dela), para ela poder enviar de novo agora.
- Um teste novo garante que uma inscrição pública é salva.

## Detalhes técnicos
- Migração: `alter table public.affiliates alter column commission_months set default 12;`
- `delete from public.rate_limits where key in ('affiliate:apply:email:tfsaraujo@hotmail.com','affiliate:apply:ip:138.117.63.154');`
- Teste em `src/test/rls.test.ts`: um insert só com nome e e-mail (como a inscrição faz) tem que funcionar e vir com `commission_months = 12`.
