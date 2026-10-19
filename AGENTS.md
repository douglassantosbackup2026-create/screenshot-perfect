<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Financial math lives only in `src/lib/calc/` as pure functions with Vitest tests; UI never computes money itself — keeps results deterministic and auditable.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate, redirects to `/entrar`); the bottom nav renders there — public pages stay SSR.
- Server-side jobs from the spec's "Edge Functions" are built as TanStack server functions/routes, not Supabase Edge Functions — matches the stack.
- Database follows the spec's §6.1 migration verbatim plus required table grants; client writes to protected tables go through the SQL RPCs.
- Screens read/write through `src/lib/data/` (currently `demo-store.ts`, localStorage, mirrors the SQL RPC semantics); swap that layer for Supabase calls rather than touching screens — keeps login wiring isolated.
- Gamification rules duplicated client-side in `src/lib/gamification/rules.ts` only for demo mode; the database functions remain the source of truth once login is wired.
- Program/mission copy lives in `src/content/` (generated from the spec §10/§11); `supabase/seed-content.sql` inserts the same content as drafts.
