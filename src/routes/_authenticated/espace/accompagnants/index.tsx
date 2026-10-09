import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createCaregiver } from "@/lib/caregivers.functions";
import { requireAdmin } from "@/lib/caregivers";
import { formatDateFr } from "@/lib/patients";
import { BackLink } from "@/components/backoffice/back-link";

export const Route = createFileRoute("/_authenticated/espace/accompagnants/")({
  beforeLoad: ({ context }) => requireAdmin(context.me),
  head: () => ({ meta: [{ title: "Profils des accompagnants — Espace professionnel" }, { name: "description", content: "Gérer les comptes des accompagnants." }, { property: "og:title", content: "Profils des accompagnants" }, { property: "og:description", content: "Gérer les comptes des accompagnants." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Caregivers,
});

async function loadCaregivers() {
  const { data: roles, error } = await supabase.from("user_roles").select("user_id").eq("role", "caregiver");
  if (error) throw error;
  const ids = (roles ?? []).map(r => r.user_id);
  if (!ids.length) return [];
  const { data } = await supabase.from("profiles").select("id,full_name,email,created_at").in("id", ids).order("full_name");
  return data ?? [];
}

function Caregivers() {
  const qc = useQueryClient();
  const create = useServerFn(createCaregiver);
  const { data, isLoading } = useQuery({ queryKey: ["caregivers"], queryFn: loadCaregivers });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setErr("Le nom et l’adresse e-mail sont obligatoires."); return; }
    if (form.password.length < 8) { setErr("Le mot de passe temporaire doit contenir au moins 8 caractères."); return; }
    setBusy(true); setErr("");
    try {
      await create({ data: form });
      setMsg(`Le compte de ${form.name} a été créé. Transmettez-lui son adresse e-mail et son mot de passe temporaire.`);
      setForm({ name: "", email: "", password: "" }); setOpen(false);
      await qc.invalidateQueries({ queryKey: ["caregivers"] });
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Le compte n’a pas pu être créé."); }
    finally { setBusy(false); }
  }

  return <>
    <BackLink to="/espace">Retour à l’accueil</BackLink>
    <h1 className="bo-title">Profils des accompagnants</h1>
    <div className="title-underline" />
    <div className="bo-actions">
      <button type="button" className="bo-btn bo-btn-primary" onClick={() => { setOpen(!open); setMsg(""); }} aria-expanded={open}><UserPlus aria-hidden="true" /> Créer un accompagnant</button>
    </div>
    {msg && <p className="bo-success" role="status">{msg}</p>}
    {open && <form className="bo-card bo-form" onSubmit={submit} noValidate>
      <h2>Nouvel accompagnant</h2>
      <label className="bo-field"><span>Nom</span><input className="bo-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="off" /></label>
      <label className="bo-field"><span>Adresse e-mail</span><input className="bo-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="off" /></label>
      <label className="bo-field"><span>Mot de passe temporaire</span><input className="bo-input" type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /><small className="bo-hint">Au moins 8 caractères.</small></label>
      {err && <p className="bo-error" role="alert">{err}</p>}
      <div className="bo-actions"><button className="bo-btn bo-btn-primary" type="submit" disabled={busy}>{busy ? "Création…" : "Créer le compte"}</button>
        <button className="bo-btn bo-btn-outline" type="button" onClick={() => setOpen(false)}>Annuler</button></div>
    </form>}
    {isLoading && <p>Chargement…</p>}
    {data && data.length === 0 && <p>Aucun accompagnant pour le moment.</p>}
    <ul className="bo-list">
      {(data ?? []).map(c => <li key={c.id}>
        <Link to="/espace/accompagnants/$id" params={{ id: c.id }} className="bo-list-item">
          <span className="bo-avatar" aria-hidden="true">{(c.full_name || c.email).slice(0, 1).toUpperCase()}</span>
          <span className="bo-list-text"><strong>{c.full_name || c.email}</strong><span>Arrivé le {formatDateFr(c.created_at)}</span></span>
        </Link>
      </li>)}
    </ul>
  </>;
}
