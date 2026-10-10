import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (!me) throw redirect({ to: "/connexion" });
    if (!me.isStaff) {
      await supabase.auth.signOut();
      context.queryClient.clear();
      throw redirect({ to: "/connexion" });
    }
    return { me };
  },
  component: BackofficeLayout,
});

function BackofficeLayout() {
  const { queryClient } = Route.useRouteContext();
  const { data: me } = useQuery(meQuery);
  const navigate = useNavigate();
  const router = useRouter();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/connexion", replace: true });
  }

  return (
    <div className="bo-shell">
      <header className="bo-header">
        <div className="bo-header-inner">
          <Link to="/espace" className="bo-brand"><span>Passeport de communication</span></Link>
          <div className="bo-header-right">
            {me && <span className="bo-user">{me.name || me.email} · {me.isAdmin ? "Administrateur" : "Accompagnant"}</span>}
            <button type="button" className="bo-btn bo-btn-outline" onClick={signOut}><LogOut aria-hidden="true" /> Déconnexion</button>
          </div>
        </div>
      </header>
      <div className="bo-page"><Outlet /></div>
    </div>
  );
}
