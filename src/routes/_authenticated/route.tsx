import { createFileRoute, Outlet, redirect, useLocation, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { BottomNav } from "@/components/BottomNav";
import { ErrorBoundary, PageError } from "@/components/ErrorBoundary";
import { LockedHeader, MobileHeader, TopNav } from "@/components/TopNav";
import { SaveNotices, SaveStatus } from "@/components/SaveStatus";
import { supabase } from "@/integrations/supabase/client";
import { attachUser } from "@/lib/data/demo-store";
import { grantAdminAccess, loadAccess, useAccess } from "@/lib/billing/access";
import { isAdmin } from "@/lib/auth/roles";

/** Abrem sem assinatura: a própria Assinatura e o Perfil (exportar dados, excluir a conta, sair). */
const OPEN_WITHOUT_SUBSCRIPTION = ["/planos", "/perfil"];

/** Conta já conferida no servidor nesta aba, e se é admin; trocar de tela não repete essas consultas. */
let verifiedUser: string | null = null;
let adminOf: { userId: string; value: boolean } | null = null;

/**
 * Quem está conectado. Na primeira tela confere a sessão no servidor (conta excluída ou sessão revogada
 * caem aqui); nas trocas de tela seguintes, basta a sessão local, sem ir à rede a cada clique.
 */
async function currentUserId(): Promise<string | null> {
  const { data: local } = await supabase.auth.getSession();
  const id = local.session?.user.id ?? null;
  if (id && id === verifiedUser) return id;
  const { data, error } = await supabase.auth.getUser();
  // Sem internet não é o mesmo que sem sessão: mandar para o login esconderia o problema real.
  if (error && isAuthRetryableFetchError(error)) throw new Error("Sem conexão. Confira a internet e tente de novo.");
  verifiedUser = data.user?.id ?? null;
  return verifiedUser;
}

async function cachedIsAdmin(userId: string): Promise<boolean> {
  if (adminOf?.userId !== userId) adminOf = { userId, value: await isAdmin() };
  return adminOf.value;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const userId = await currentUserId();
    if (!userId) throw redirect({ to: "/entrar", search: { redirect: location.pathname } });
    const s = await attachUser(userId);
    // Não existe plano grátis: sem assinatura, só a Assinatura e o Perfil. Admin entra sempre.
    const access = await loadAccess(userId);
    if (!access.active) {
      if (await cachedIsAdmin(userId)) grantAdminAccess();
      else if (OPEN_WITHOUT_SUBSCRIPTION.some((p) => location.pathname.startsWith(p))) return;
      else throw redirect({ to: "/planos" });
    }
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
  const { active } = useAccess();
  const hideNav = !active || pathname.startsWith("/onboarding") || pathname.startsWith("/programa");
  return (
    <>
      <SaveNotices />
      {!active && <LockedHeader />}
      {!hideNav && <TopNav />}
      {!hideNav && <MobileHeader />}
      {/* Sem o topo do app, o aviso de "não salvo" fica no canto (o LockedHeader já mostra o dele). */}
      {hideNav && active && (
        <div className="fixed right-4 top-4 z-40">
          <SaveStatus />
        </div>
      )}
      {/* Uma tela que quebra não leva a navegação junto; trocar de tela tenta de novo. */}
      <ErrorBoundary resetKey={pathname} fallback={(reset) => <PageError onRetry={reset} />}>
        <Outlet />
      </ErrorBoundary>
      {!hideNav && <BottomNav />}
    </>
  );
}
