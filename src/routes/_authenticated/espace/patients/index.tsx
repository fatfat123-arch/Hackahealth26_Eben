import { createFileRoute, Link } from "@tanstack/react-router";
import { List, UserPlus } from "lucide-react";
import { BackLink } from "@/components/backoffice/back-link";

export const Route = createFileRoute("/_authenticated/espace/patients/")({
  head: () => ({ meta: [{ title: "Profils des patients — Espace professionnel" }, { name: "description", content: "Consulter ou créer un profil de patient." }, { property: "og:title", content: "Profils des patients" }, { property: "og:description", content: "Consulter ou créer un profil de patient." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PatientsHome,
});

function PatientsHome() {
  const { me } = Route.useRouteContext();
  return <>
    {me.isAdmin && <BackLink to="/espace">Retour à l’accueil</BackLink>}
    <h1 className="bo-title">Profils des patients</h1>
    <div className="title-underline" />
    <div className="bo-choices">
      <Link to="/espace/patients/liste" className="bo-choice"><List aria-hidden="true" /><span>Voir les profils existants</span></Link>
      <Link to="/espace/patients/nouveau" className="bo-choice"><UserPlus aria-hidden="true" /><span>Créer un nouveau profil</span></Link>
    </div>
  </>;
}
