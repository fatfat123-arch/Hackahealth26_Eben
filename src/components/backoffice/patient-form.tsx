import { useId, useState, type ReactNode } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as Tabs from "@radix-ui/react-tabs";
import { DictionaryCard } from "@/components/passport/dictionary-card";
import { MEDIA_BUCKET, mediaTypeFromFile, formatDateFr, type DictItem, type PatientDraft } from "@/lib/patients";

type Props = {
  draft: PatientDraft;
  onChange: (d: PatientDraft) => void;
  urls: Record<string, string>;
  onUrls: (u: Record<string, string>) => void;
  readOnly: boolean;
  folder: string;
  updatedAt: string | null;
};

const kindLabel: Record<DictItem["type"], string> = { image: "Photo", gif: "Image animée", video: "Vidéo", audio: "Son" };

async function uploadFile(file: File, folder: string) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `patients/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="bo-field"><span>{label}</span>{children}{hint && <small className="bo-hint">{hint}</small>}</label>;
}

function ReadValue({ label, value }: { label: string; value: ReactNode }) {
  return <div className="bo-read"><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function ListEditor({ title, items, onChange, readOnly }: { title: string; items: string[]; onChange: (l: string[]) => void; readOnly: boolean }) {
  const id = useId();
  return <fieldset className="bo-fieldset">
    <legend>{title}</legend>
    {readOnly ? (items.length ? <ul className="passport-list">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p>Aucune information.</p>) : <>
      {items.map((t, i) => <div key={i} className="bo-row">
        <label className="sr-only" htmlFor={`${id}-${i}`}>{title}, point {i + 1}</label>
        <input id={`${id}-${i}`} className="bo-input" value={t} onChange={e => onChange(items.map((x, j) => j === i ? e.target.value : x))} />
        <button type="button" className="bo-btn bo-btn-outline bo-icon-btn" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Supprimer le point ${i + 1}`}><Trash2 aria-hidden="true" /></button>
      </div>)}
      <button type="button" className="bo-btn bo-btn-outline" onClick={() => onChange([...items, ""])}><Plus aria-hidden="true" /> Ajouter un point</button>
    </>}
  </fieldset>;
}

const STEPS = [["identite", "Identité"], ["dictionnaire", "Dictionnaire"], ["gouts", "Centres d’intérêt et peurs"], ["autres", "Autres informations"]] as const;

function Steps({ parts }: { parts: [ReactNode, ReactNode, ReactNode, ReactNode] }) {
  return <Tabs.Root defaultValue="identite" className="bo-steps-tabs">
    <Tabs.List className="bo-tablist" aria-label="Étapes du profil">
      {STEPS.map(([v, l], i) => <Tabs.Trigger key={v} value={v} className="bo-steptab"><span className="bo-step-num" aria-hidden="true">{i + 1}</span>{l}</Tabs.Trigger>)}
    </Tabs.List>
    {STEPS.map(([v], i) => <Tabs.Content key={v} value={v} className="bo-readonly bo-tabpanel">{parts[i]}</Tabs.Content>)}
  </Tabs.Root>;
}

export function PatientForm({ draft, onChange, urls, onUrls, readOnly, folder, updatedAt }: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const set = <K extends keyof PatientDraft>(k: K, v: PatientDraft[K]) => onChange({ ...draft, [k]: v });

  async function handleUpload(file: File | undefined, key: string, apply: (path: string) => void, accept?: (f: File) => boolean) {
    if (!file) return;
    if (accept && !accept(file)) { setError("Ce type de fichier n’est pas accepté."); return; }
    setError(""); setUploading(key);
    try {
      const path = await uploadFile(file, folder);
      onUrls({ ...urls, [path]: URL.createObjectURL(file) });
      apply(path);
    } catch { setError("Le fichier n’a pas pu être envoyé. Réessayez."); }
    finally { setUploading(null); }
  }

  const setEntry = (i: number, patch: Partial<DictItem>) => set("dictionary", draft.dictionary.map((e, j) => j === i ? { ...e, ...patch } : e));

  if (readOnly) {
    return <Steps parts={[<>
      <section className="bo-card"><h2>Photo</h2>
        {draft.photoPath && urls[draft.photoPath] ? <img className="bo-photo" src={urls[draft.photoPath]} alt={draft.photoAlt || `Photo de ${draft.name}`} /> : <p>Aucune photo.</p>}
      </section>
      <section className="bo-card"><h2>Comment utiliser cette page</h2><p className="bo-pre">{draft.howTo || "—"}</p></section>
      <section className="bo-card"><h2>À propos de moi</h2><p className="bo-pre">{draft.about || "—"}</p></section>
      <section className="bo-card"><h2>Informations</h2>
        <dl className="bo-read-list">
          <ReadValue label="Nom" value={draft.name} />
          <ReadValue label="Date de naissance" value={draft.birthDate ? formatDateFr(draft.birthDate) : ""} />
          <ReadValue label="Téléphone" value={draft.phone && <>{draft.phone}{draft.phoneNote && ` (${draft.phoneNote})`}</>} />
          <ReadValue label="Adresse" value={draft.address} />
          <ReadValue label="Message important" value={draft.reminder} />
          <ReadValue label="Dernière mise à jour" value={formatDateFr(updatedAt)} />
        </dl>
      </section>
</>, <>
      <section className="bo-card"><h2>Mon dictionnaire</h2>
        {draft.dictionary.length === 0 ? <p>Aucune entrée.</p> : <div className="dictionary-grid">
          {draft.dictionary.map(e => <DictionaryCard key={e.id} entry={{ ...e, alt: e.alt || e.title, source: urls[e.path] ?? "", poster: e.posterPath ? urls[e.posterPath] : undefined }} />)}
        </div>}
      </section>
</>, <>
      <section className="bo-card"><ListEditor title="Mes centres d’intérêt" items={draft.interests} onChange={() => {}} readOnly /></section>
      <section className="bo-card"><ListEditor title="Mes peurs / Ce que je n’aime pas" items={draft.dislikes} onChange={() => {}} readOnly /></section>
</>, <>
      <section className="bo-card"><ListEditor title="Autres informations" items={draft.additional} onChange={() => {}} readOnly /></section>
</>]} />;
  }

  return <>
    {error && <p className="bo-error" role="alert">{error}</p>}
    <Steps parts={[<>
    <section className="bo-card"><h2>Photo</h2>
      <div className="bo-photo-edit">
        {draft.photoPath && urls[draft.photoPath] ? <img className="bo-photo" src={urls[draft.photoPath]} alt={draft.photoAlt || "Photo actuelle"} /> : <div className="photo-placeholder">Pas de photo</div>}
        <div className="bo-stack">
          <label className="bo-btn bo-btn-outline bo-file"><Upload aria-hidden="true" /> {uploading === "photo" ? "Envoi en cours…" : draft.photoPath ? "Remplacer la photo" : "Choisir une photo"}
            <input type="file" accept="image/*" className="sr-only" onChange={e => handleUpload(e.target.files?.[0], "photo", p => set("photoPath", p), f => f.type.startsWith("image/"))} />
          </label>
          {draft.photoPath && <button type="button" className="bo-btn bo-btn-outline" onClick={() => set("photoPath", null)}>Retirer la photo</button>}
          <Field label="Description de la photo" hint="Pour les personnes qui ne voient pas l’image."><input className="bo-input" value={draft.photoAlt} onChange={e => set("photoAlt", e.target.value)} /></Field>
        </div>
      </div>
    </section>
    <section className="bo-card"><h2>Comment utiliser cette page</h2><Field label="Texte"><textarea className="bo-input bo-textarea" value={draft.howTo} onChange={e => set("howTo", e.target.value)} /></Field></section>
    <section className="bo-card"><h2>À propos de moi</h2><Field label="Texte"><textarea className="bo-input bo-textarea" value={draft.about} onChange={e => set("about", e.target.value)} /></Field></section>
    <section className="bo-card"><h2>Informations</h2>
      <div className="bo-grid2">
        <Field label="Nom (obligatoire)"><input className="bo-input" required value={draft.name} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Date de naissance"><input className="bo-input" type="date" value={draft.birthDate} onChange={e => set("birthDate", e.target.value)} /></Field>
        <Field label="Téléphone"><input className="bo-input" type="tel" value={draft.phone} onChange={e => set("phone", e.target.value)} /></Field>
        <Field label="À propos du numéro" hint="Par exemple : Ma personne de confiance"><input className="bo-input" value={draft.phoneNote} onChange={e => set("phoneNote", e.target.value)} /></Field>
        <Field label="Adresse"><input className="bo-input" value={draft.address} onChange={e => set("address", e.target.value)} /></Field>
        <Field label="Message important" hint="Affiché en évidence sous le profil."><input className="bo-input" value={draft.reminder} onChange={e => set("reminder", e.target.value)} /></Field>
      </div>
      <p className="bo-hint">Dernière mise à jour : {updatedAt ? formatDateFr(updatedAt) : "pas encore enregistré"} (mise à jour automatique à chaque enregistrement).</p>
    </section>
</>, <>
    <section className="bo-card"><h2>Mon dictionnaire</h2>
      <div className="bo-dict-edit">
        {draft.dictionary.map((e, i) => <fieldset key={e.id} className="bo-fieldset bo-dict-item">
          <legend>Entrée {i + 1}{e.path ? ` · ${kindLabel[e.type]}` : ""}</legend>
          {e.path && urls[e.path] && <div className="bo-dict-preview"><DictionaryCard entry={{ ...e, alt: e.alt || e.title, source: urls[e.path] ?? "", poster: e.posterPath ? urls[e.posterPath] : undefined }} /></div>}
          <label className="bo-btn bo-btn-outline bo-file"><Upload aria-hidden="true" /> {uploading === e.id ? "Envoi en cours…" : e.path ? "Remplacer le fichier" : "Choisir un fichier (image, GIF, vidéo ou son)"}
            <input type="file" accept="image/*,video/*,audio/*" className="sr-only" onChange={ev => {
              const f = ev.target.files?.[0];
              const t = f ? mediaTypeFromFile(f) : null;
              handleUpload(f, e.id, p => setEntry(i, { path: p, type: t ?? "image", posterPath: undefined }), file => !!mediaTypeFromFile(file));
            }} />
          </label>
          <Field label="Signification (titre)"><input className="bo-input" value={e.title} onChange={ev => setEntry(i, { title: ev.target.value })} placeholder="Par exemple : J’ai soif" /></Field>
          <Field label="Explication"><input className="bo-input" value={e.description} onChange={ev => setEntry(i, { description: ev.target.value })} /></Field>
          <Field label="Description du média" hint="Pour les personnes qui ne voient pas ou n’entendent pas."><input className="bo-input" value={e.alt} onChange={ev => setEntry(i, { alt: ev.target.value })} /></Field>
          {e.type === "audio" && <Field label="Transcription du son"><input className="bo-input" value={e.transcript ?? ""} onChange={ev => setEntry(i, { transcript: ev.target.value })} /></Field>}
          <button type="button" className="bo-btn bo-btn-outline" onClick={() => set("dictionary", draft.dictionary.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /> Supprimer cette entrée</button>
        </fieldset>)}
      </div>
      <button type="button" className="bo-btn bo-btn-outline" onClick={() => set("dictionary", [...draft.dictionary, { id: crypto.randomUUID(), type: "image", title: "", description: "", path: "", alt: "" }])}><Plus aria-hidden="true" /> Ajouter une entrée</button>
    </section>
</>, <>
    <section className="bo-card"><ListEditor title="Mes centres d’intérêt" items={draft.interests} onChange={l => set("interests", l)} readOnly={false} /></section>
    <section className="bo-card"><ListEditor title="Mes peurs / Ce que je n’aime pas" items={draft.dislikes} onChange={l => set("dislikes", l)} readOnly={false} /></section>
</>, <>
    <section className="bo-card"><ListEditor title="Autres informations" items={draft.additional} onChange={l => set("additional", l)} readOnly={false} /></section>
</>]} />
  </>;
}
