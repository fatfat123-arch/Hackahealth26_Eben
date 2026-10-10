import { publicPassportUrl, linkUsesPreview } from "@/lib/site-url";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BookOpen, ListOrdered, Copy, Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signPaths } from "@/lib/session";
import { draftPaths, draftToRow, rowToDraft, type PatientDraft, type PatientRow } from "@/lib/patients";
import { PatientForm, FIELD_DRAFT_KEYS, FIELD_LABELS, type FieldKey } from "@/components/backoffice/patient-form";
import { askConfirm } from "@/components/backoffice/confirm-dialog";
import { PreviewPanel } from "@/components/backoffice/preview-panel";
import { BackLink } from "@/components/backoffice/back-link";
import { Mascot } from "@/components/mascot";
import { consumeJustSaved } from "@/lib/saved-flag";

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
    const u = publicPassportUrl(id);
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
      {linkUsesPreview() && <p className="bo-hint">Ce lien utilise l’adresse de prévisualisation. Publiez le site pour obtenir le lien définitif à mettre sur le code QR ou la puce NFC.</p>}
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
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState<PatientDraft | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(() => consumeJustSaved(id) ? "Profil enregistré" : "");
  const [err, setErr] = useState("");

  useEffect(() => { if (data && !editing) { setDraft(data.draft); setUrls(u => ({ ...u, ...data.urls })); } }, [data]);

  if (isLoading || (data && !draft)) return <p>Chargement…</p>;
  if (error) return <p className="bo-error" role="alert">Le profil n’a pas pu être chargé.</p>;
  if (!data || !draft) return <><BackLink to="/espace/patients/liste">Retour à la liste</BackLink><h1 className="bo-title">Profil introuvable</h1></>;
  const saved = data.draft;

  const dirty = (k: FieldKey) => FIELD_DRAFT_KEYS[k].some(key => JSON.stringify(draft[key]) !== JSON.stringify(saved[key]));
  const revert = (k: FieldKey) => setDraft(d => d && FIELD_DRAFT_KEYS[k].reduce((acc, key) => ({ ...acc, [key]: saved[key] }), d));

  async function saveField(k: FieldKey): Promise<boolean> {
    if (!draft) return false;
    if (k === "name" && !draft.name.trim()) { setErr("Le nom est obligatoire."); return false; }
    const full = draftToRow(draft) as Record<string, unknown>;
    const cols = Object.fromEntries(FIELD_DRAFT_KEYS[k].map(key => { const c = COLUMN[key]; return [c, full[c]]; }));
    setBusy(true); setErr("");
    const { error } = await supabase.from("patients").update(cols as never).eq("id", id);
    setBusy(false);
    if (error) { setErr("Désolé, la modification n’a pas pu être enregistrée. Merci de réessayer."); return false; }
    setEditing(null);
    setMsg(`Modification enregistrée : ${FIELD_LABELS[k]}`);
    await qc.invalidateQueries({ queryKey: ["patient", id] });
    await qc.invalidateQueries({ queryKey: ["patients"] });
    return true;
  }
  async function startEdit(k: FieldKey) {
    setMsg(""); setErr("");
    if (editing && editing !== k && dirty(editing)) {
      const ok = await askConfirm(`Vous avez modifié « ${FIELD_LABELS[editing]} » sans enregistrer.`, { kind: "save", title: "Enregistrer les modifications ?", confirmLabel: "Enregistrer", cancelLabel: "Annuler les modifications" });
      if (ok) { if (!(await saveField(editing))) return; } else revert(editing);
    } else if (editing) revert(editing);
    setEditing(k);
  }
  function cancel(k: FieldKey) { revert(k); setEditing(null); setErr(""); }

  if (preview) return <PreviewPanel draft={draft} urls={urls} updatedAt={data.row.updated_at} onClose={() => setPreview(false)} />;

  return <>
    <BackLink to="/espace/patients/liste">Retour à la liste</BackLink>
    <h1 className="bo-title">{data.row.name}</h1>
    <div className="title-underline" />
    <div className="bo-actions">
      <button type="button" className="bo-btn bo-btn-outline" onClick={() => setPreview(true)}><Eye aria-hidden="true" /> Aperçu</button>
      <Link to="/espace/tutoriel" search={{ id }} className="bo-btn bo-btn-outline"><BookOpen aria-hidden="true" /> Tutoriel</Link>
      <button type="button" className="bo-btn bo-btn-outline" onClick={async () => { await startEdit("sectionOrder"); requestAnimationFrame(() => document.getElementById("section-order")?.scrollIntoView({ block: "start" })); }}><ListOrdered aria-hidden="true" /> Réorganiser les sections</button>
    </div>
    <p className="bo-hint">Pour modifier une information, cliquez sur le crayon à côté de celle-ci.</p>
    {msg && <div className="bo-saved" role="status"><Mascot pose="joie" size={88} /><div><strong>{msg}</strong><p>Merci ! Le changement est visible tout de suite sur la page publique.</p></div></div>}
    {err && <p className="bo-error" role="alert">{err}</p>}
    <PublicLink id={id} name={data.row.name} />
    <PatientForm draft={draft} onChange={setDraft} urls={urls} onUrls={setUrls} readOnly folder={id} updatedAt={data.row.updated_at}
      inline={{ editing, busy, onEdit: startEdit, onSave: k => { void saveField(k); }, onCancel: cancel }} />
  </>;
}

const COLUMN: Record<keyof PatientDraft, string> = {
  name: "name", birthDate: "birth_date", phone: "phone", phoneNote: "phone_note", address: "address", about: "about", howTo: "how_to", reminder: "reminder",
  photoPath: "photo_path", dictionary: "dictionary", communicates: "communicates", understandingNeeds: "understanding_needs", tools: "tools", facilitators: "facilitators",
  interests: "interests", dislikes: "dislikes", additional: "additional", sectionOrder: "section_order",
};
