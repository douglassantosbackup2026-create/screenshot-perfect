import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";

// MODO DEMONSTRAÇÃO: o bloqueio de login está desligado de propósito até a etapa de login.
// Para religar, restaurar o beforeLoad abaixo:
//   beforeLoad: async () => {
//     const { data } = await supabase.auth.getUser();
//     if (!data.user) throw redirect({ to: "/entrar" });
//   },
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith("/onboarding") || pathname.startsWith("/programa");
  return (
    <>
      <div role="status" className="bg-accent px-4 py-1.5 text-center text-xs font-semibold text-accent-foreground">
        Modo demonstração: seus dados ainda não são salvos
      </div>
      {!hideNav && <TopNav />}
      <Outlet />
      {!hideNav && <BottomNav />}
    </>
  );
}
