import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signPaths } from "@/lib/session";
import { formatDateFr } from "@/lib/patients";
import { BackLink } from "@/components/backoffice/back-link";

export const Route = createFileRoute("/_authenticated/espace/patients/liste")({
  head: () => ({ meta: [{ title: "Profils existants — Espace professionnel" }, { name: "description", content: "Liste partagée des profils de patients." }, { property: "og:title", content: "Profils existants" }, { property: "og:description", content: "Liste partagée des profils de patients." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PatientList,
});

async function loadPatients() {
  const { data, error } = await supabase.from("patients").select("id,name,photo_path,photo_alt,updated_at").order("name");
  if (error) throw error;
  const urls = await signPaths((data ?? []).map(p => p.photo_path ?? ""));
  return { patients: data ?? [], urls };
}

function PatientList() {
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["patients"], queryFn: loadPatients, refetchInterval: 30_000 });
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const list = (data?.patients ?? []).filter(p => norm(p.name).includes(norm(q.trim())));

  return <>
    <BackLink to="/espace/patients">Retour aux profils des patients</BackLink>
    <h1 className="bo-title">Profils existants</h1>
    <div className="title-underline" />
    <label className="bo-field bo-search"><span>Rechercher par nom</span>
      <span className="bo-search-box"><Search aria-hidden="true" /><input className="bo-input" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Par exemple : Julien" /></span>
    </label>
    {isLoading && <p>Chargement…</p>}
    {error && <p className="bo-error" role="alert">La liste n’a pas pu être chargée.</p>}
    {data && list.length === 0 && <p>Aucun profil ne correspond à votre recherche.</p>}
    <ul className="bo-list">
      {list.map(p => <li key={p.id}>
        <Link to="/espace/patients/$id" params={{ id: p.id }} className="bo-list-item">
          {p.photo_path && data?.urls[p.photo_path] ? <img src={data.urls[p.photo_path]} alt="" width={64} height={64} /> : <span className="bo-avatar" aria-hidden="true">{p.name.slice(0, 1)}</span>}
          <span className="bo-list-text"><strong>{p.name || "Sans nom"}</strong><span>Dernière mise à jour : {formatDateFr(p.updated_at)}</span></span>
        </Link>
      </li>)}
    </ul>
  </>;
}
