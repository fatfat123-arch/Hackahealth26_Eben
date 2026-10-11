import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Mascot } from "@/components/mascot";
import { NavigationIcon } from "@/components/backoffice/navigation-icon";

export const Route = createFileRoute("/_authenticated/espace/")({
  beforeLoad: ({ context }) => {
    if (!context.me.isAdmin) throw redirect({ to: "/espace/patients" });
  },
  head: () => ({
    meta: [
      { title: "Accueil — Espace professionnel" },
      { name: "description", content: "Accueil de l’espace administrateur." },
      { property: "og:title", content: "Espace professionnel" },
      { property: "og:description", content: "Accueil de l’espace administrateur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const { me } = Route.useRouteContext();
  const first = (me.name || "").trim().split(/\s+/)[0];
  return (
    <>
      <div className="bo-greeting">
        <Mascot pose="salut" size={120} />
        <div>
          <h1 className="bo-title">{first ? `Bonjour, ${first}` : "Bonjour"}</h1>
          <div className="title-underline" />
          <p className="bo-lead">Que souhaitez-vous faire aujourd’hui ?</p>
        </div>
      </div>
      <div className="bo-choices">
        <Link to="/espace/patients" className="bo-choice">
          <NavigationIcon name="patient" />
          <span>Profils des patients</span>
        </Link>
        <Link to="/espace/accompagnants" className="bo-choice">
          <NavigationIcon name="accompagnants" />
          <span>Profils des accompagnants</span>
        </Link>
      </div>
    </>
  );
}
