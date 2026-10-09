import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { UserRound, UsersRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/espace/")({
  beforeLoad: ({ context }) => { if (!context.me.isAdmin) throw redirect({ to: "/espace/patients" }); },
  head: () => ({ meta: [{ title: "Accueil — Espace professionnel" }, { name: "description", content: "Accueil de l’espace administrateur." }, { property: "og:title", content: "Espace professionnel" }, { property: "og:description", content: "Accueil de l’espace administrateur." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AdminHome,
});

function AdminHome() {
  return <>
    <h1 className="bo-title">Accueil</h1>
    <div className="title-underline" />
    <div className="bo-choices">
      <Link to="/espace/patients" className="bo-choice"><UserRound aria-hidden="true" /><span>Profils des patients</span></Link>
      <Link to="/espace/accompagnants" className="bo-choice"><UsersRound aria-hidden="true" /><span>Profils des accompagnants</span></Link>
    </div>
  </>;
}
