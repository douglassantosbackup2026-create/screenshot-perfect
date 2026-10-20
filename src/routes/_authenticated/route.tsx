import { useEffect } from "react";
import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { MobileHeader, TopNav } from "@/components/TopNav";
import { startCloud, stopCloud, useCloudStatus } from "@/lib/data/cloud";
import { useDemo } from "@/lib/data/demo-store";
import { getSession, isDemoMode, useSession } from "@/lib/data/session";

// Só entra com login ou no modo "experimentar sem conta". Roda no navegador (a sessão fica lá).
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSession();
    if (!session && !isDemoMode()) throw redirect({ to: "/entrar" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { ready, session } = useSession();
  const cloud = useCloudStatus();
  const s = useDemo();
  const userId = session?.user.id ?? null;

  // Com sessão, os dados vêm do banco; sem sessão (modo demonstração), deste aparelho.
  useEffect(() => {
    if (!ready) return;
    if (userId) void startCloud(userId);
    else {
      stopCloud();
      if (!isDemoMode()) navigate({ to: "/entrar", replace: true });
    }
  }, [ready, userId, navigate]);

  const inCloud = !!userId;
  const loading = !ready || (inCloud && (!cloud.loaded || cloud.userId !== userId));
  // Conta nova (ou onboarding pela metade): primeiro o onboarding.
  const needsOnboarding = inCloud && !loading && !s.profile.onboardingCompletedAt && !pathname.startsWith("/onboarding");
  useEffect(() => {
    if (needsOnboarding) navigate({ to: "/onboarding", replace: true });
  }, [needsOnboarding, navigate]);

  const hideNav = pathname.startsWith("/onboarding") || pathname.startsWith("/programa");

  if (loading || needsOnboarding) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-5 text-center" aria-busy="true">
        <span className="h-3 w-3 animate-pulse rounded-full bg-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">{cloud.error ? "Não deu para carregar seus dados." : "Carregando seus dados…"}</p>
        {cloud.error && (
          <button type="button" className="text-sm font-semibold text-primary" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        )}
      </main>
    );
  }

  return (
    <>
      {!inCloud && (
        <div role="status" className="bg-accent px-4 py-1.5 text-center text-xs font-semibold text-accent-foreground">
          Modo demonstração: seus dados ficam só neste aparelho.{" "}
          <Link to="/cadastro" className="underline">
            Criar conta
          </Link>
        </div>
      )}
      {!hideNav && <TopNav />}
      {!hideNav && <MobileHeader />}
      <Outlet />
      {!hideNav && <BottomNav />}
    </>
  );
}
