# Previdência Intelligence — MVP build plan

Your Supabase project is already connected. We follow the spec's 12-step order, testing in the preview between steps. This first round covers steps 1–3 (the foundation); later steps follow one at a time.

## Round 1 (this approval)

1. **App base and design system (spec §4, §5)**
   - Portuguese (pt-BR) throughout, mobile first.
   - Colors from §4 in light and dark modes, Bricolage Grotesque for titles and Public Sans for text, tabular numbers for money, no all-caps, no gradients, reduced-motion respected.
   - Empty pages for every route in §5 (home, calculator, sign-in, onboarding, Hoje, programa/:dia, Plano, Diário, Perfil, admin/conteúdo).
   - Bottom navigation (Hoje, Plano, Diário, Perfil) shown only on signed-in pages.
   - Each page gets its own title and description.

2. **Database (spec §6.1)**
   - Run the §6.1 SQL migration exactly as written, then confirm every table has row-level security on.
   - If something conflicts with the current Supabase (for example missing grants), I report it instead of quietly rewriting it.

3. **Calculation engine and tests (spec §7)**
   - Add the retirement math, formatting, and test files exactly as in §7.2–7.4, then run the tests. If a test fails, I show you the error and leave the formulas and tests unchanged.

## Next rounds (one per message, in spec order)
4 Sign-in and onboarding · 5 21-day program and lessons · 6 Plano · 7 Diário and the "fio da constância" · 8 Hoje, streaks, levels, achievements, missions · 9 Perfil and privacy · 10 Home and public calculator · 11 E-mail reminders · 12 Analytics and final review.

## Technical notes
- Stack is TanStack Start (file routes in `src/routes`), not React Router; signed-in pages go under `_authenticated/`.
- Colors go in as oklch tokens in `src/styles.css` (converted from the spec's hex values), to match how the template handles theming.
- Server-only work from §6.3 (delete account, reminders) becomes TanStack server functions/routes instead of Supabase Edge Functions. Reminders get a public route that checks the caller and runs on pg_cron.
- Vitest is already configured; the §7 tests live in `src/lib/calc/`.
- Rules from §3 and design decisions get saved to project memory.
