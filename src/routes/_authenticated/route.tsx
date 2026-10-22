import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { MobileHeader, TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { attachUser } from "@/lib/data/demo-store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/entrar", search: { redirect: location.pathname } });
    const s = await attachUser(data.user.id);
    if (!s.profile.onboardingCompletedAt && !location.pathname.startsWith("/onboarding")) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith("/onboarding") || pathname.startsWith("/programa");
  return (
    <>
      {!hideNav && <TopNav />}
      {!hideNav && <MobileHeader />}
      <Outlet />
      {!hideNav && <BottomNav />}
    </>
  );
}
