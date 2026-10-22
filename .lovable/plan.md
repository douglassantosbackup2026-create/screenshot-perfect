# Login com e-mail e senha (substitui o link de acesso)

## O que muda para a pessoa
- **/entrar** — e-mail + senha, botão "Entrar", link "Esqueci minha senha", link "Criar conta". Google continua como opção.
- **/cadastro** (nova) — nome, e-mail, senha, confirmar senha, aceite dos termos e da política de privacidade. Regras de senha visíveis (mínimo 8 caracteres, com letra e número).
- **Confirmação de e-mail** — depois do cadastro, tela "Confira seu e-mail para confirmar a conta". Ao clicar no link do e-mail, a pessoa volta já logada e segue para o onboarding.
- **/esqueci-senha** (nova) — pede o e-mail e envia o link de redefinição.
- **/redefinir-senha** (nova) — define a nova senha e entra no app.
- **Perfil** — nova opção "Trocar senha" (pede a senha atual).
- Mensagens de erro em português e claras: senha errada, e-mail não confirmado, e-mail já cadastrado, senha fraca.
- O link mágico deixa de existir.

## Fluxo
```text
Home -> Começar grátis -> /cadastro -> confirmar e-mail -> /onboarding -> /hoje
/entrar -> e-mail+senha -> /hoje (ou a página que tentou abrir)
/entrar -> Esqueci minha senha -> e-mail -> /redefinir-senha -> /hoje
```
O progresso feito antes do cadastro continua sendo levado para a conta.

## O que você precisa fazer no Supabase
- Authentication -> Providers -> Email: ligar "Email" e "Confirm email".
- URL Configuration: adicionar `/entrar` e `/redefinir-senha` (preview e publicado) como Redirect URLs.

## Detalhes técnicos
- `signUp({ email, password, options: { emailRedirectTo: origin + "/entrar", data: { display_name } } })`; tratar `session === null` como "confirme seu e-mail".
- `signInWithPassword`; `resetPasswordForEmail(email, { redirectTo: origin + "/redefinir-senha" })`; recuperação com `updateUser({ password })`; troca logada com `updateUser({ password, current_password })`.
- Nome salvo no `profiles` existente do §6.1 (via metadata/trigger já existente ou update após o primeiro login — verificar na implementação).
- Rotas públicas novas no topo de `src/routes/`; gate `_authenticated` inalterado (redireciona para `/entrar`).
- Validação de formulário com zod; regra de senha em função pura com teste Vitest.
- `head()` próprio para cada página nova.
