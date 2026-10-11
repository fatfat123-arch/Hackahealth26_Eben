import { createFileRoute, Link } from "@tanstack/react-router";
import { BackLink } from "@/components/backoffice/back-link";
import { NavigationIcon } from "@/components/backoffice/navigation-icon";
import { Mascot } from "@/components/mascot";

export const Route = createFileRoute("/_authenticated/espace/patients/")({
  head: () => ({
    meta: [
      { title: "Profils des résidents — Espace professionnel" },
      { name: "description", content: "Consulter ou créer un profil de résident." },
      { property: "og:title", content: "Profils des résidents" },
      { property: "og:description", content: "Consulter ou créer un profil de résident." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientsHome,
});

function PatientsHome() {
  const { me } = Route.useRouteContext();
  const first = (me.name || "").trim().split(/\s+/)[0];
  return (
    <>
      {me.isAdmin && <BackLink to="/espace">Retour à l’accueil</BackLink>}
      {!me.isAdmin ? (
        <div className="bo-greeting">
          <Mascot pose="salut" size={120} />
          <div>
            <h1 className="bo-title">{first ? `Bonjour, ${first}` : "Bonjour"}</h1>
            <div className="title-underline" />
            <p className="bo-lead">Que souhaitez-vous faire aujourd’hui ?</p>
          </div>
        </div>
      ) : (
        <>
          <h1 className="bo-title">Profils des résidents</h1>
          <div className="title-underline" />
        </>
      )}
      <div className="bo-choices">
        <Link to="/espace/patients/liste" className="bo-choice">
          <NavigationIcon name="liste" />
          <span>Voir les profils existants</span>
        </Link>
        <Link to="/espace/patients/nouveau" className="bo-choice">
          <NavigationIcon name="ajouter" />
          <span>Créer un nouveau profil</span>
        </Link>
      </div>
    </>
  );
}
