import { createFileRoute, Outlet, redirect, useLocation, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { BottomNav } from "@/components/BottomNav";
import { ErrorBoundary, PageError } from "@/components/ErrorBoundary";
import { MobileHeader, TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { attachUser } from "@/lib/data/demo-store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    // Sem internet não é o mesmo que sem sessão: mandar para o login esconderia o problema real.
    if (error && isAuthRetryableFetchError(error)) throw new Error("Sem conexão. Confira a internet e tente de novo.");
    if (!data.user) throw redirect({ to: "/entrar", search: { redirect: location.pathname } });
    const s = await attachUser(data.user.id);
    const onboarding = location.pathname.startsWith("/onboarding");
    if (!s.profile.onboardingCompletedAt && !onboarding) throw redirect({ to: "/onboarding" });
    // Refazer o onboarding apagaria tudo o que a pessoa já registrou.
    if (s.profile.onboardingCompletedAt && onboarding) throw redirect({ to: "/hoje" });
  },
  component: AuthenticatedLayout,
  errorComponent: LoadError,
  pendingMs: 150,
  pendingComponent: Loading,
});

/** Enquanto confere a sessão e carrega os dados da pessoa. */
function Loading() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pt-8 lg:max-w-3xl" aria-busy="true" aria-label="Carregando seus dados">
      <div className="h-8 w-40 animate-pulse rounded-xl bg-card" />
      <div className="mt-6 h-36 animate-pulse rounded-2xl bg-card" />
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-card" />
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-card" />
    </main>
  );
}

/** Falha ao conferir a sessão ou carregar os dados (sem internet, banco fora do ar). */
function LoadError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return <PageError message={error instanceof Error ? error.message : undefined} onRetry={() => void router.invalidate()} />;
}

function AuthenticatedLayout() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith("/onboarding") || pathname.startsWith("/programa");
  return (
    <>
      {!hideNav && <TopNav />}
      {!hideNav && <MobileHeader />}
      {/* Uma tela que quebra não leva a navegação junto; trocar de tela tenta de novo. */}
      <ErrorBoundary resetKey={pathname} fallback={(reset) => <PageError onRetry={reset} />}>
        <Outlet />
      </ErrorBoundary>
      {!hideNav && <BottomNav />}
    </>
  );
}
