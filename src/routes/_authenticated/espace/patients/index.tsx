import { createFileRoute, Link } from "@tanstack/react-router";
import { List, UserPlus } from "lucide-react";
import { BackLink } from "@/components/backoffice/back-link";
import { Mascot } from "@/components/mascot";

export const Route = createFileRoute("/_authenticated/espace/patients/")({
  head: () => ({
    meta: [
      { title: "Profils des patients — Espace professionnel" },
      { name: "description", content: "Consulter ou créer un profil de patient." },
      { property: "og:title", content: "Profils des patients" },
      { property: "og:description", content: "Consulter ou créer un profil de patient." },
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
          <h1 className="bo-title">Profils des patients</h1>
          <div className="title-underline" />
        </>
      )}
      <div className="bo-choices">
        <Link to="/espace/patients/liste" className="bo-choice">
          <List aria-hidden="true" />
          <span>Voir les profils existants</span>
        </Link>
        <Link to="/espace/patients/nouveau" className="bo-choice">
          <UserPlus aria-hidden="true" />
          <span>Créer un nouveau profil</span>
        </Link>
      </div>
    </>
  );
}
