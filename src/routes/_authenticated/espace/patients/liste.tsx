import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RowMenu, CONFIRM_DELETE } from "@/components/backoffice/row-menu";
import { useState } from "react";
import { Search } from "lucide-react";
import { archivePatient, deletePatient, listPatients } from "@/lib/patients.functions";
import { signPaths } from "@/lib/session";
import { formatDateFr } from "@/lib/patients";
import { BackLink } from "@/components/backoffice/back-link";
import { askConfirm } from "@/components/backoffice/confirm-dialog";
import { EmptyState } from "@/components/mascot";

export const Route = createFileRoute("/_authenticated/espace/patients/liste")({
  head: () => ({
    meta: [
      { title: "Profils existants — Espace professionnel" },
      { name: "description", content: "Liste partagée des profils de patients." },
      { property: "og:title", content: "Profils existants" },
      { property: "og:description", content: "Liste partagée des profils de patients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientList,
});

async function loadPatients() {
  const data = await listPatients();
  const urls = await signPaths(data.map((p) => String(p.photo_path ?? "")));
  return { patients: data, urls };
}

function PatientList() {
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState(false);
  const [err, setErr] = useState("");
  const qc = useQueryClient();
  async function setArchive(id: string, value: boolean) {
    setErr("");
    try {
      await archivePatient({ data: { id, archived: value } });
      await qc.invalidateQueries({ queryKey: ["patients"] });
    } catch {
      setErr("Désolé, le profil n’a pas pu être modifié. Merci de réessayer.");
    }
  }
  async function remove(id: string) {
    if (!(await askConfirm(CONFIRM_DELETE))) return;
    setErr("");
    try {
      await deletePatient({ data: id });
      await qc.invalidateQueries({ queryKey: ["patients"] });
    } catch {
      setErr("Désolé, le profil n’a pas pu être supprimé. Merci de réessayer.");
    }
  }
  const { data, isLoading, error } = useQuery({
    queryKey: ["patients"],
    queryFn: loadPatients,
    refetchInterval: 30_000,
  });
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const list = (data?.patients ?? [])
    .filter((p) => !!p.archived_at === archived)
    .filter((p) => norm(p.name).includes(norm(q.trim())));

  return (
    <>
      <BackLink to="/espace/patients">Retour aux profils des patients</BackLink>
      <h1 className="bo-title">Profils existants</h1>
      <div className="title-underline" />
      <label className="bo-field bo-search">
        <span>Rechercher par nom</span>
        <span className="bo-search-box">
          <Search aria-hidden="true" />
          <input
            className="bo-input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Par exemple : Julien"
          />
        </span>
      </label>
      <div className="bo-tabs" role="group" aria-label="Filtre">
        <button
          type="button"
          className="bo-tab"
          aria-pressed={!archived}
          onClick={() => setArchived(false)}
        >
          Profils actifs
        </button>
        <button
          type="button"
          className="bo-tab"
          aria-pressed={archived}
          onClick={() => setArchived(true)}
        >
          Profils archivés
        </button>
      </div>
      {err && (
        <p className="bo-error" role="alert">
          {err}
        </p>
      )}
      {isLoading && <p>Chargement…</p>}
      {error && (
        <p className="bo-error" role="alert">
          La liste n’a pas pu être chargée.
        </p>
      )}
      {data &&
        list.length === 0 &&
        (q.trim() ? (
          <EmptyState text="Aucun profil ne correspond à cette recherche. Essayez un autre nom." />
        ) : archived ? (
          <EmptyState text="Aucun profil archivé pour le moment." />
        ) : (
          <EmptyState text="Aucun profil pour le moment. Créez le premier !">
            <Link to="/espace/patients/nouveau" className="bo-btn bo-btn-primary">
              Créer un nouveau profil
            </Link>
          </EmptyState>
        ))}
      <ul className="bo-list">
        {list.map((p) => (
          <li key={p.id} className="bo-row-wrap">
            <Link to="/espace/patients/$id" params={{ id: p.id }} className="bo-list-item">
              {p.photo_path && data?.urls[p.photo_path] ? (
                <img src={data.urls[p.photo_path]} alt="" width={64} height={64} />
              ) : (
                <span className="bo-avatar" aria-hidden="true">
                  {p.name.slice(0, 1)}
                </span>
              )}
              <span className="bo-list-text">
                <strong>{p.name || "Sans nom"}</strong>
                <span>Mis à jour le : {formatDateFr(p.updated_at)}</span>
              </span>
            </Link>
            <RowMenu
              label={p.name || "ce profil"}
              actions={[
                archived
                  ? { label: "Restaurer", onSelect: () => setArchive(p.id, false) }
                  : { label: "Archiver", onSelect: () => setArchive(p.id, true) },
                { label: "Supprimer", danger: true, onSelect: () => remove(p.id) },
              ]}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
