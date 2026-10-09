import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updateCaregiver } from "@/lib/caregivers.functions";
import { requireAdmin } from "@/lib/caregivers";
import { formatDateFr } from "@/lib/patients";
import { BackLink } from "@/components/backoffice/back-link";

export const Route = createFileRoute("/_authenticated/espace/accompagnants/$id")({
  beforeLoad: ({ context }) => requireAdmin(context.me),
  head: () => ({ meta: [{ title: "Accompagnant — Espace professionnel" }, { name: "description", content: "Fiche d’un accompagnant." }, { property: "og:title", content: "Accompagnant" }, { property: "og:description", content: "Fiche d’un accompagnant." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CaregiverPage,
});

async function load(id: string) {
  const [{ data: profile }, { data: patients }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,created_at").eq("id", id).maybeSingle(),
    supabase.from("patients").select("id,name,updated_at").eq("created_by", id).order("name"),
  ]);
  return { profile, patients: patients ?? [] };
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

  if (isLoading) return <p>Chargement…</p>;
  if (!data?.profile) return <><BackLink to="/espace/accompagnants">Retour à la liste</BackLink><h1 className="bo-title">Accompagnant introuvable</h1></>;
  const p = data.profile;

  async function save() {
    setBusy(true); setErr("");
    try {
      await update({ data: { id, ...form } });
      await qc.invalidateQueries({ queryKey: ["caregiver", id] });
      await qc.invalidateQueries({ queryKey: ["caregivers"] });
      setEdit(false); setMsg("Modifications enregistrées.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Les modifications n’ont pas pu être enregistrées."); }
    finally { setBusy(false); }
  }

  return <>
    <BackLink to="/espace/accompagnants">Retour à la liste</BackLink>
    <h1 className="bo-title">{p.full_name || p.email}</h1>
    <div className="title-underline" />
    <div className="bo-actions">
      {edit ? <>
        <button type="button" className="bo-btn bo-btn-primary" onClick={save} disabled={busy}><Save aria-hidden="true" /> {busy ? "Enregistrement…" : "Enregistrer"}</button>
        <button type="button" className="bo-btn bo-btn-outline" onClick={() => { setEdit(false); setErr(""); }}><X aria-hidden="true" /> Annuler</button>
      </> : <button type="button" className="bo-btn bo-btn-primary" onClick={() => { setForm({ name: p.full_name, email: p.email }); setEdit(true); setMsg(""); }}><Pencil aria-hidden="true" /> Modifier</button>}
    </div>
    {msg && <p className="bo-success" role="status">{msg}</p>}
    {err && <p className="bo-error" role="alert">{err}</p>}
    <section className="bo-card">
      <h2>Informations</h2>
      {edit ? <div className="bo-grid2">
        <label className="bo-field"><span>Nom</span><input className="bo-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="bo-field"><span>Adresse e-mail</span><input className="bo-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      </div> : <dl className="bo-read-list">
        <div className="bo-read"><dt>Nom</dt><dd>{p.full_name || "—"}</dd></div>
        <div className="bo-read"><dt>Adresse e-mail</dt><dd>{p.email}</dd></div>
        <div className="bo-read"><dt>Date d’arrivée</dt><dd>{formatDateFr(p.created_at)}</dd></div>
      </dl>}
    </section>
    <section className="bo-card">
      <h2>Profils créés</h2>
      {data.patients.length === 0 ? <p>Aucun profil créé pour le moment.</p> :
        <ul className="bo-link-list">{data.patients.map(pt => <li key={pt.id}><Link to="/espace/patients/$id" params={{ id: pt.id }}>{pt.name || "Sans nom"}</Link> <span className="bo-hint">· mis à jour le {formatDateFr(pt.updated_at)}</span></li>)}</ul>}
    </section>
  </>;
}
