import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BookOpen, Copy, Download, Eye, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signPaths } from "@/lib/session";
import { draftPaths, draftToRow, rowToDraft, type PatientDraft, type PatientRow } from "@/lib/patients";
import { PatientForm } from "@/components/backoffice/patient-form";
import { PreviewPanel } from "@/components/backoffice/preview-panel";
import { BackLink } from "@/components/backoffice/back-link";

export const Route = createFileRoute("/_authenticated/espace/patients/$id")({
  head: () => ({ meta: [{ title: "Profil du patient — Espace professionnel" }, { name: "description", content: "Consulter et modifier un passeport de communication." }, { property: "og:title", content: "Profil du patient" }, { property: "og:description", content: "Consulter et modifier un passeport de communication." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PatientPage,
});

async function loadPatient(id: string) {
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PatientRow;
  const draft = rowToDraft(row);
  return { row, draft, urls: await signPaths(draftPaths(draft)) };
}

function PublicLink({ id, name }: { id: string; name: string }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const u = `${window.location.origin}/passeport/${id}`;
    setUrl(u);
    QRCode.toDataURL(u, { width: 600, margin: 2, color: { dark: "#004d95", light: "#ffffff" } }).then(setQr);
  }, [id]);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  }
  const file = `qr-passeport-${name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.png`;
  return <section className="bo-card bo-link-card" aria-labelledby="link-title">
    <div>
      <h2 id="link-title">Lien vers la page publique</h2>
      <p>C’est l’adresse à mettre dans le code QR ou la puce NFC.</p>
      <p className="bo-url"><a href={url} target="_blank" rel="noreferrer">{url}</a></p>
      <div className="bo-actions">
        <button type="button" className="bo-btn bo-btn-outline" onClick={copy}><Copy aria-hidden="true" /> Copier le lien</button>
        {qr && <a className="bo-btn bo-btn-outline" href={qr} download={file}><Download aria-hidden="true" /> Télécharger le code QR</a>}
      </div>
      {copied && <p role="status" className="bo-hint">Lien copié.</p>}
    </div>
    {qr && <img className="bo-qr" src={qr} alt={`Code QR menant au passeport de ${name}`} width={180} height={180} />}
  </section>;
}

function PatientPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["patient", id], queryFn: () => loadPatient(id) });
  const [mode, setMode] = useState<"view" | "edit" | "preview">("view");
  const [draft, setDraft] = useState<PatientDraft | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (data && mode === "view") { setDraft(data.draft); setUrls(data.urls); } }, [data, mode]);

  if (isLoading || (data && !draft)) return <p>Chargement…</p>;
  if (error) return <p className="bo-error" role="alert">Le profil n’a pas pu être chargé.</p>;
  if (!data || !draft) return <><BackLink to="/espace/patients/liste">Retour à la liste</BackLink><h1 className="bo-title">Profil introuvable</h1></>;

  const editing = mode === "edit";
  const [prevMode, setPrevMode] = [mode, setMode];

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) { setErr("Le nom est obligatoire."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.from("patients").update(draftToRow(draft)).eq("id", id);
    setBusy(false);
    if (error) { setErr("Les modifications n’ont pas pu être enregistrées."); return; }
    await qc.invalidateQueries({ queryKey: ["patient", id] });
    await qc.invalidateQueries({ queryKey: ["patients"] });
    setMode("view"); setMsg("Modifications enregistrées.");
  }

  if (mode === "preview") return <PreviewPanel draft={draft} urls={urls} updatedAt={data.row.updated_at} onClose={() => setMode(editing ? "edit" : (sessionStorage.getItem("pv-from") as "edit" | "view") || "view")} />;

  return <>
    <BackLink to="/espace/patients/liste">Retour à la liste</BackLink>
    <h1 className="bo-title">{data.row.name}</h1>
    <div className="title-underline" />
    <div className="bo-actions">
      {editing ? <>
        <button type="button" className="bo-btn bo-btn-primary" onClick={save} disabled={busy}><Save aria-hidden="true" /> {busy ? "Enregistrement…" : "Enregistrer"}</button>
        <button type="button" className="bo-btn bo-btn-outline" onClick={() => { setErr(""); setMode("view"); setDraft(data.draft); setUrls(data.urls); }}><X aria-hidden="true" /> Annuler</button>
      </> : <button type="button" className="bo-btn bo-btn-primary" onClick={() => { setMsg(""); setMode("edit"); }}><Pencil aria-hidden="true" /> Modifier</button>}
      <button type="button" className="bo-btn bo-btn-outline" onClick={() => { sessionStorage.setItem("pv-from", prevMode); setPrevMode("preview"); }}><Eye aria-hidden="true" /> Aperçu</button>
      <Link to="/espace/tutoriel" search={{ id }} className="bo-btn bo-btn-outline"><BookOpen aria-hidden="true" /> Tutoriel</Link>
    </div>
    {msg && <p className="bo-success" role="status">{msg}</p>}
    {err && <p className="bo-error" role="alert">{err}</p>}
    {!editing && <PublicLink id={id} name={data.row.name} />}
    <PatientForm draft={draft} onChange={setDraft} urls={urls} onUrls={setUrls} readOnly={!editing} folder={id} updatedAt={data.row.updated_at} />
    {editing && <div className="bo-actions bo-actions-end">
      <button type="button" className="bo-btn bo-btn-primary" onClick={save} disabled={busy}><Save aria-hidden="true" /> Enregistrer</button>
      <button type="button" className="bo-btn bo-btn-outline" onClick={() => { setMode("view"); setDraft(data.draft); setUrls(data.urls); }}><X aria-hidden="true" /> Annuler</button>
    </div>}
  </>;
}
