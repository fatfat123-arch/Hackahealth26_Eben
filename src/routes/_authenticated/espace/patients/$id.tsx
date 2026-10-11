import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BookOpen, ListOrdered, Eye } from "lucide-react";
import { getPatient, resetPatientPublicUrl, updatePatient } from "@/lib/patients.functions";
import { signPaths } from "@/lib/session";
import {
  draftPaths,
  draftToRow,
  patientValidationError,
  rowToDraft,
  type PatientDraft,
  type PatientRow,
} from "@/lib/patients";
import {
  PatientForm,
  FIELD_DRAFT_KEYS,
  FIELD_LABELS,
  type FieldKey,
} from "@/components/backoffice/patient-form";
import { askConfirm } from "@/components/backoffice/confirm-dialog";
import { PreviewPanel } from "@/components/backoffice/preview-panel";
import { BackLink } from "@/components/backoffice/back-link";
import { Mascot } from "@/components/mascot";
import { consumeJustSaved } from "@/lib/saved-flag";
import { PublicPassportLink } from "@/components/backoffice/public-passport-link";
import { PatientProfileDownload } from "@/components/backoffice/patient-profile-download";

export const Route = createFileRoute("/_authenticated/espace/patients/$id")({
  head: () => ({
    meta: [
      { title: "Profil du patient — Espace professionnel" },
      { name: "description", content: "Consulter et modifier un passeport de communication." },
      { property: "og:title", content: "Profil du patient" },
      {
        property: "og:description",
        content: "Consulter et modifier un passeport de communication.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientPage,
});

async function loadPatient(id: string) {
  const data = await getPatient({ data: id });
  if (!data) return null;
  const row = data as unknown as PatientRow;
  const draft = rowToDraft(row);
  return { row, draft, urls: await signPaths(draftPaths(draft)) };
}

function PatientPage() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => loadPatient(id),
  });
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState<PatientDraft | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [publicId, setPublicId] = useState("");
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(() => (consumeJustSaved(id) ? "Profil enregistré" : ""));
  const [err, setErr] = useState("");

  useEffect(() => {
    if (data && !editing) {
      setDraft(data.draft);
      setUrls((u) => ({ ...u, ...data.urls }));
      setPublicId(data.row.public_id);
    }
  }, [data]);

  if (isLoading || (data && !draft)) return <p>Chargement…</p>;
  if (error)
    return (
      <p className="bo-error" role="alert">
        Le profil n’a pas pu être chargé.
      </p>
    );
  if (!data || !draft)
    return (
      <>
        <BackLink to="/espace/patients/liste">Retour à la liste</BackLink>
        <h1 className="bo-title">Profil introuvable</h1>
      </>
    );
  const saved = data.draft;

  const dirty = (k: FieldKey) =>
    FIELD_DRAFT_KEYS[k].some((key) => JSON.stringify(draft[key]) !== JSON.stringify(saved[key]));
  const revert = (k: FieldKey) =>
    setDraft(
      (d) => d && FIELD_DRAFT_KEYS[k].reduce((acc, key) => ({ ...acc, [key]: saved[key] }), d),
    );

  async function saveField(k: FieldKey): Promise<boolean> {
    if (!draft) return false;
    const validationError = patientValidationError(draft);
    if (validationError) {
      setErr(validationError);
      return false;
    }
    const full = draftToRow(draft) as Record<string, unknown>;
    const cols = Object.fromEntries(
      FIELD_DRAFT_KEYS[k].map((key) => {
        const c = COLUMN[key];
        return [c, full[c]];
      }),
    );
    setBusy(true);
    setErr("");
    let failed = false;
    try {
      await updatePatient({ data: { id, changes: cols } });
    } catch {
      failed = true;
    }
    setBusy(false);
    if (failed) {
      setErr("Désolé, la modification n’a pas pu être enregistrée. Merci de réessayer.");
      return false;
    }
    setEditing(null);
    setMsg(`Modification enregistrée : ${FIELD_LABELS[k]}`);
    await qc.invalidateQueries({ queryKey: ["patient", id] });
    await qc.invalidateQueries({ queryKey: ["patients"] });
    return true;
  }
  async function startEdit(k: FieldKey) {
    setMsg("");
    setErr("");
    if (editing && editing !== k && dirty(editing)) {
      const ok = await askConfirm(
        `Vous avez modifié « ${FIELD_LABELS[editing]} » sans enregistrer.`,
        {
          kind: "save",
          title: "Enregistrer les modifications ?",
          confirmLabel: "Enregistrer",
          cancelLabel: "Annuler les modifications",
        },
      );
      if (ok) {
        if (!(await saveField(editing))) return;
      } else revert(editing);
    } else if (editing) revert(editing);
    setEditing(k);
  }
  function cancel(k: FieldKey) {
    revert(k);
    setEditing(null);
    setErr("");
  }

  async function openPreview() {
    setErr("");
    try {
      await qc.refetchQueries({ queryKey: ["patient", id], exact: true });
      setPreview(true);
    } catch {
      setErr("L’aperçu n’a pas pu être chargé. Merci de réessayer.");
    }
  }
  async function resetPublicUrl() {
    const res = await resetPatientPublicUrl({ data: id });
    setPublicId(res.public_id);
    await qc.invalidateQueries({ queryKey: ["patient", id] });
  }

  // The preview always shows the latest saved record, never unsaved edits or a cached copy.
  if (preview)
    return (
      <PreviewPanel
        patientId={id}
        draft={data.draft}
        urls={{ ...urls, ...data.urls }}
        updatedAt={data.row.updated_at}
        onClose={() => setPreview(false)}
      />
    );
  return (
    <>
      <BackLink to="/espace/patients/liste">Retour à la liste</BackLink>
      <h1 className="bo-title">{data.row.name}</h1>
      <div className="title-underline" />
      <div className="bo-actions">
        <button type="button" className="bo-btn bo-btn-outline" onClick={openPreview}>
          <Eye aria-hidden="true" /> Aperçu
        </button>
        <PatientProfileDownload key={id} patientId={id} />
        <Link
          to="/espace/tutoriel"
          search={{ id, publicId: publicId || data.row.public_id }}
          className="bo-btn bo-btn-outline"
        >
          <BookOpen aria-hidden="true" /> Tutoriel
        </Link>
        <button
          type="button"
          className="bo-btn bo-btn-outline"
          onClick={async () => {
            await startEdit("sectionOrder");
            requestAnimationFrame(() =>
              document.getElementById("section-order")?.scrollIntoView({ block: "start" }),
            );
          }}
        >
          <ListOrdered aria-hidden="true" /> Gérer les sections
        </button>
      </div>
      <p className="bo-hint">
        Pour modifier une information, cliquez sur le crayon à côté de celle-ci.
      </p>
      {msg && (
        <div className="bo-saved" role="status">
          <Mascot pose="joie" size={88} />
          <div>
            <strong>{msg}</strong>
            <p>Merci ! Le changement est visible tout de suite sur la page publique.</p>
          </div>
        </div>
      )}
      {err && (
        <p className="bo-error" role="alert">
          {err}
        </p>
      )}
      <PublicPassportLink
        key={id}
        patientId={id}
        publicId={publicId || data.row.public_id}
        name={data.row.name}
        onReset={resetPublicUrl}
      />
      <PatientForm
        draft={draft}
        onChange={setDraft}
        urls={urls}
        onUrls={setUrls}
        readOnly
        folder={id}
        updatedAt={data.row.updated_at}
        canCartoonise={me.isAdmin}
        inline={{
          editing,
          busy,
          onEdit: startEdit,
          onSave: (k) => {
            void saveField(k);
          },
          onCancel: cancel,
        }}
      />
    </>
  );
}

const COLUMN: Record<keyof PatientDraft, string> = {
  name: "name",
  birthDate: "birth_date",
  phone: "phone",
  phoneNote: "phone_note",
  address: "address",
  about: "about",
  howTo: "how_to",
  reminder: "reminder",
  photoPath: "photo_path",
  photoPositionY: "photo_position_y",
  dictionary: "dictionary",
  communicates: "communicates",
  understandingNeeds: "understanding_needs",
  tools: "tools",
  facilitators: "facilitators",
  interests: "interests",
  dislikes: "dislikes",
  additional: "additional",
  sectionOrder: "section_order",
  customSections: "section_order",
};
