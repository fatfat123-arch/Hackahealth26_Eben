import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { KeyRound, Pencil, Save, X } from "lucide-react";
import { updateCaregiver, resetPassword, getCaregiver } from "@/lib/caregivers.functions";
import { requireAdmin } from "@/lib/caregivers";
import { formatDateFr } from "@/lib/patients";
import { PasswordField } from "@/components/backoffice/password-field";
import { BackLink } from "@/components/backoffice/back-link";
import { UserRoleControl } from "@/components/backoffice/user-role-control";

export const Route = createFileRoute("/_authenticated/espace/accompagnants/$id")({
  beforeLoad: ({ context }) => requireAdmin(context.me),
  head: () => ({
    meta: [
      { title: "Accompagnant — Espace professionnel" },
      { name: "description", content: "Fiche d’un accompagnant." },
      { property: "og:title", content: "Accompagnant" },
      { property: "og:description", content: "Fiche d’un accompagnant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaregiverPage,
});

async function load(id: string) {
  return getCaregiver({ data: id });
}

function CaregiverPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const update = useServerFn(updateCaregiver);
  const { data, isLoading } = useQuery({ queryKey: ["caregiver", id], queryFn: () => load(id) });
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = useServerFn(resetPassword);
  const { me } = Route.useRouteContext();
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");

  if (isLoading) return <p>Chargement…</p>;
  if (!data?.profile)
    return (
      <>
        <BackLink to="/espace/accompagnants">Retour à la liste</BackLink>
        <h1 className="bo-title">Accompagnant introuvable</h1>
      </>
    );
  const p = data.profile;

  async function save() {
    setBusy(true);
    setErr("");
    try {
      await update({ data: { id, ...form } });
      await qc.invalidateQueries({ queryKey: ["caregiver", id] });
      await qc.invalidateQueries({ queryKey: ["caregivers"] });
      setEdit(false);
      setMsg("Modifications enregistrées.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Les modifications n’ont pas pu être enregistrées.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (pw.length < 8) {
      setErr("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await reset({ data: { id, password: pw } });
      setPw("");
      setPwOpen(false);
      setMsg("Le mot de passe a été réinitialisé. Transmettez-le à la personne concernée.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Le mot de passe n’a pas pu être modifié.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink to="/espace/accompagnants">Retour à la liste</BackLink>
      <h1 className="bo-title">{p.full_name || p.email}</h1>
      <div className="title-underline" />
      <section className="bo-card">
        <h2>Rôle du compte</h2>
        {(id === me.id || p.archived_at) && (
          <p>{p.role === "admin" ? "Administrateur" : "Accompagnant"}</p>
        )}
        <UserRoleControl user={p} actorId={me.id} isAdmin={me.isAdmin} />
      </section>
      <div className="bo-actions">
        {edit ? (
          <>
            <button type="button" className="bo-btn bo-btn-primary" onClick={save} disabled={busy}>
              <Save aria-hidden="true" /> {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              className="bo-btn bo-btn-outline"
              onClick={() => {
                setEdit(false);
                setErr("");
              }}
            >
              <X aria-hidden="true" /> Annuler
            </button>
          </>
        ) : (
          <button
            type="button"
            className="bo-btn bo-btn-primary"
            onClick={() => {
              setForm({ name: p.full_name, email: p.email });
              setEdit(true);
              setMsg("");
            }}
          >
            <Pencil aria-hidden="true" /> Modifier
          </button>
        )}
      </div>
      {msg && (
        <p className="bo-success" role="status">
          {msg}
        </p>
      )}
      {err && (
        <p className="bo-error" role="alert">
          {err}
        </p>
      )}
      <section className="bo-card">
        <h2>Informations</h2>
        {edit ? (
          <div className="bo-grid2">
            <label className="bo-field">
              <span>Nom</span>
              <input
                className="bo-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="bo-field">
              <span>Adresse e-mail</span>
              <input
                className="bo-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
          </div>
        ) : (
          <dl className="bo-read-list">
            <div className="bo-read">
              <dt>Nom</dt>
              <dd>{p.full_name || "—"}</dd>
            </div>
            <div className="bo-read">
              <dt>Adresse e-mail</dt>
              <dd>{p.email}</dd>
            </div>
            <div className="bo-read">
              <dt>Date d’arrivée</dt>
              <dd>{formatDateFr(p.created_at)}</dd>
            </div>
          </dl>
        )}
      </section>
      {id !== me.id && (
        <section className="bo-card">
          <h2>Mot de passe</h2>
          <p className="bo-hint">
            Le mot de passe actuel n’est jamais affiché. Vous pouvez en définir un nouveau.
          </p>
          {pwOpen ? (
            <>
              <PasswordField label="Nouveau mot de passe" value={pw} onChange={setPw} />
              <div className="bo-actions">
                <button
                  type="button"
                  className="bo-btn bo-btn-primary"
                  onClick={savePassword}
                  disabled={busy}
                >
                  <Save aria-hidden="true" />{" "}
                  {busy ? "Enregistrement…" : "Confirmer le nouveau mot de passe"}
                </button>
                <button
                  type="button"
                  className="bo-btn bo-btn-outline"
                  onClick={() => {
                    setPwOpen(false);
                    setPw("");
                    setErr("");
                  }}
                >
                  <X aria-hidden="true" /> Annuler
                </button>
              </div>
            </>
          ) : (
            <div className="bo-actions">
              <button
                type="button"
                className="bo-btn bo-btn-outline"
                onClick={() => {
                  setPwOpen(true);
                  setMsg("");
                }}
              >
                <KeyRound aria-hidden="true" /> Réinitialiser le mot de passe
              </button>
            </div>
          )}
        </section>
      )}
      <section className="bo-card">
        <h2>Profils créés</h2>
        {data.patients.length === 0 ? (
          <p>Aucun profil créé pour le moment.</p>
        ) : (
          <ul className="bo-link-list">
            {data.patients.map((pt) => (
              <li key={pt.id}>
                <Link to="/espace/patients/$id" params={{ id: pt.id }}>
                  {pt.name || "Sans nom"}
                </Link>{" "}
                <span className="bo-hint">· mis à jour le {formatDateFr(pt.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
