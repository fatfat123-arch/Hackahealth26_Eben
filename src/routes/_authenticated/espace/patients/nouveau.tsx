import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Eye, Save } from "lucide-react";
import { createPatient } from "@/lib/patients.functions";
import { draftToRow, emptyDraft, patientValidationError } from "@/lib/patients";
import { PatientForm } from "@/components/backoffice/patient-form";
import { PreviewPanel } from "@/components/backoffice/preview-panel";
import { BackLink } from "@/components/backoffice/back-link";
import { markJustSaved } from "@/lib/saved-flag";

export const Route = createFileRoute("/_authenticated/espace/patients/nouveau")({
  head: () => ({ meta: [{ title: "Nouveau profil — Espace professionnel" }, { name: "description", content: "Créer un nouveau passeport de communication." }, { property: "og:title", content: "Nouveau profil" }, { property: "og:description", content: "Créer un nouveau passeport de communication." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: NewPatient,
});

function NewPatient() {
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [id] = useState(() => crypto.randomUUID());
  const [draft, setDraft] = useState(emptyDraft);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const validationError = patientValidationError(draft);
    if (validationError) { setError(validationError); window.scrollTo(0, 0); return; }
    setBusy(true); setError("");
    let failed = false;
    try { await createPatient({ data: { id, row: draftToRow(draft) } }); } catch { failed = true; }
    setBusy(false);
    if (failed) { setError("Désolé, le profil n’a pas pu être enregistré. Merci de réessayer."); return; }
    await qc.invalidateQueries({ queryKey: ["patients"] });
    markJustSaved(id);
    navigate({ to: "/espace/patients/$id", params: { id } });
  }

  if (preview) return <PreviewPanel draft={draft} urls={urls} updatedAt={null} onClose={() => setPreview(false)} />;

  return <>
    <BackLink to="/espace/patients">Retour aux profils des patients</BackLink>
    <h1 className="bo-title">Créer un nouveau profil</h1>
    <div className="title-underline" />
    <div className="bo-actions">
      <button type="button" className="bo-btn bo-btn-primary" onClick={save} disabled={busy}><Save aria-hidden="true" /> {busy ? "Enregistrement…" : "Enregistrer"}</button>
      <button type="button" className="bo-btn bo-btn-outline" onClick={() => setPreview(true)}><Eye aria-hidden="true" /> Aperçu</button>
      <Link to="/espace/tutoriel" target="_blank" className="bo-btn bo-btn-outline"><BookOpen aria-hidden="true" /> Tutoriel</Link>
    </div>
    {error && <p className="bo-error" role="alert">{error}</p>}
    <PatientForm draft={draft} onChange={setDraft} urls={urls} onUrls={setUrls} readOnly={false} folder={id} updatedAt={null} canCartoonise={me.isAdmin} />
    <div className="bo-actions bo-actions-end">
      <button type="button" className="bo-btn bo-btn-primary" onClick={save} disabled={busy}><Save aria-hidden="true" /> {busy ? "Enregistrement…" : "Enregistrer le profil"}</button>
    </div>
  </>;
}
