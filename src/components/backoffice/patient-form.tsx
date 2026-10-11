import { Fragment, useId, useState, type ReactNode } from "react";
import { Pencil, Plus, Save, Trash2, Upload, WandSparkles, X } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { DictionaryCard } from "@/components/passport/dictionary-card";
import { DictionaryGrid } from "@/components/passport/dictionary-grid";
import { SortableDictionaryEntry } from "@/components/backoffice/sortable-dictionary-entry";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { SectionOrderEditor } from "@/components/backoffice/section-order-editor";
import { sectionTitle } from "@/lib/section-order";
import { moveDictionaryEntry } from "@/lib/dictionary-order";
import { mediaTypeFromFile, formatDateFr, type DictItem, type PatientDraft } from "@/lib/patients";
import { mediaFileError } from "@/lib/media-limits";

export type FieldKey =
  | "photo"
  | "name"
  | "birthDate"
  | "phone"
  | "reminder"
  | "about"
  | "howTo"
  | "dictionary"
  | "communicates"
  | "understandingNeeds"
  | "tools"
  | "facilitators"
  | "interests"
  | "dislikes"
  | "additional"
  | "sectionOrder";
export const FIELD_LABELS: Record<FieldKey, string> = {
  photo: "Photo",
  name: "Nom",
  birthDate: "Date de naissance",
  phone: "Téléphone",
  reminder: "Message important",
  about: "À propos de moi",
  howTo: "Comment utiliser cette page",
  dictionary: "Mon dictionnaire",
  communicates: "Je communique",
  understandingNeeds: "Ce dont j’ai besoin pour comprendre",
  tools: "Mes outils de communication",
  facilitators: "Ce qui facilite ma communication et la relation",
  interests: "Mes centres d’intérêt",
  dislikes: "Mes peurs / Ce que je n’aime pas",
  additional: "Autres informations",
  sectionOrder: "Gestion des sections",
};
/** Draft keys saved together with each editable field. */
export const FIELD_DRAFT_KEYS: Record<FieldKey, (keyof PatientDraft)[]> = {
  photo: ["photoPath", "photoPositionY"],
  name: ["name"],
  birthDate: ["birthDate"],
  phone: ["phone", "phoneNote"],
  reminder: ["reminder"],
  about: ["about"],
  howTo: ["howTo"],
  dictionary: ["dictionary"],
  communicates: ["communicates"],
  understandingNeeds: ["understandingNeeds"],
  tools: ["tools"],
  facilitators: ["facilitators"],
  interests: ["interests"],
  dislikes: ["dislikes"],
  additional: ["additional"],
  sectionOrder: ["sectionOrder", "customSections"],
};
export type InlineCtl = {
  editing: FieldKey | null;
  busy: boolean;
  onEdit: (k: FieldKey) => void;
  onSave: (k: FieldKey) => void;
  onCancel: (k: FieldKey) => void;
};

function PencilBtn({ k, inline }: { k: FieldKey; inline: InlineCtl }) {
  return (
    <button
      type="button"
      className="bo-pencil"
      aria-label={`Modifier ${FIELD_LABELS[k]}`}
      onClick={() => inline.onEdit(k)}
    >
      <Pencil aria-hidden="true" />
    </button>
  );
}
function EditBar({ k, inline }: { k: FieldKey; inline: InlineCtl }) {
  return (
    <div className="bo-inline-actions">
      <button
        type="button"
        className="bo-btn bo-btn-primary bo-btn-sm"
        onClick={() => inline.onSave(k)}
        disabled={inline.busy}
      >
        <Save aria-hidden="true" /> {inline.busy ? "Enregistrement…" : "Enregistrer"}
      </button>
      <button
        type="button"
        className="bo-btn bo-btn-outline bo-btn-sm"
        onClick={() => inline.onCancel(k)}
        disabled={inline.busy}
      >
        <X aria-hidden="true" /> Annuler
      </button>
    </div>
  );
}

type Props = {
  draft: PatientDraft;
  onChange: (d: PatientDraft) => void;
  urls: Record<string, string>;
  onUrls: (u: Record<string, string>) => void;
  readOnly: boolean;
  inline?: InlineCtl;
  folder: string;
  updatedAt: string | null;
  canCartoonise?: boolean;
};

const kindLabel: Record<DictItem["type"], string> = {
  image: "Photo",
  gif: "Image animée",
  video: "Vidéo",
  audio: "Son",
};

async function uploadFile(file: File, folder: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("patientId", folder);
  const response = await fetch("/api/upload", { method: "POST", body });
  if (!response.ok) throw new Error(await response.text());
  return ((await response.json()) as { path: string }).path;
}

async function imageAsWebp(file: File) {
  if (!/^image\/(jpeg|png)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.86),
  );
  if (!blob) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}

async function cartooniseVideo(file: File) {
  const body = new FormData();
  body.append("video", file);
  const response = await fetch("/api/cartoonise", {
    method: "POST",
    body,
  });
  if (!response.ok) throw new Error(await response.text());
  const blob = await response.blob();
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-cartoon.mp4`, {
    type: "video/mp4",
  });
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string | undefined;
}) {
  return (
    <label className="bo-field">
      <span>{label}</span>
      {children}
      {hint && <small className="bo-hint">{hint}</small>}
    </label>
  );
}

function ReadValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bo-read">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function ListEditor({
  title,
  items,
  onChange,
  readOnly,
  hideLegend,
  keywords = false,
}: {
  title: string;
  items: string[];
  onChange: (l: string[]) => void;
  readOnly: boolean;
  hideLegend?: boolean;
  keywords?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="bo-fieldset">
      <legend className={hideLegend ? "sr-only" : undefined}>{title}</legend>
      {readOnly ? (
        items.length ? (
          <ul className={keywords ? "passport-tags" : "passport-list"}>
            {items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : (
          <p>Aucune information.</p>
        )
      ) : (
        <>
          {items.map((t, i) => (
            <div key={i} className="bo-row">
              <label className="sr-only" htmlFor={`${id}-${i}`}>
                {title}, {keywords ? "mot-clé" : "point"} {i + 1}
              </label>
              <input
                id={`${id}-${i}`}
                className="bo-input"
                value={t}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button
                type="button"
                className="bo-btn bo-btn-outline bo-icon-btn"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={`Supprimer le point ${i + 1}`}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="bo-btn bo-btn-outline"
            onClick={() => onChange([...items, ""])}
          >
            <Plus aria-hidden="true" /> Ajouter {keywords ? "un mot-clé" : "un point"}
          </button>
        </>
      )}
    </fieldset>
  );
}

type ProfileStep = { id: string; label: string; content: ReactNode };

function Steps({ steps }: { steps: ProfileStep[] }) {
  return (
    <Tabs.Root defaultValue={steps[0]!.id} className="bo-steps-tabs">
      <Tabs.List className="bo-tablist" aria-label="Étapes du profil">
        {steps.map((step, index) => (
          <Tabs.Trigger key={step.id} value={step.id} className="bo-steptab">
            <span className="bo-step-num" aria-hidden="true">
              {index + 1}
            </span>
            {step.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {steps.map((step) => (
        <Tabs.Content key={step.id} value={step.id} className="bo-readonly bo-tabpanel">
          {step.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

export function PatientForm({
  draft,
  onChange,
  urls,
  onUrls,
  readOnly,
  folder,
  updatedAt,
  canCartoonise = false,
  inline: inlineProp,
}: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [cartoonProgress, setCartoonProgress] = useState<{
    key: string;
    value: number;
    label: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const set = <K extends keyof PatientDraft>(k: K, v: PatientDraft[K]) =>
    onChange({ ...draft, [k]: v });
  function moveEntry(from: number, to: number) {
    const next = moveDictionaryEntry(draft.dictionary, from, to);
    if (next === draft.dictionary) return;
    set("dictionary", next);
    setOrderMessage(`Entrée déplacée à la position ${to + 1} sur ${next.length}.`);
  }

  async function handleUpload(
    file: File | undefined,
    key: string,
    apply: (path: string) => void,
    accept?: (f: File) => boolean,
    useCartooniser = false,
  ) {
    if (!file) return;
    if (accept && !accept(file)) {
      setError("Ce type de fichier n’est pas accepté.");
      return;
    }
    const sizeError = mediaFileError(file);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    setError("");
    setUploading(key);
    try {
      const uploaded =
        useCartooniser && file.type.startsWith("video/")
          ? await cartooniseVideo(file)
          : await imageAsWebp(file);
      const path = await uploadFile(uploaded, folder);
      onUrls({ ...urls, [path]: URL.createObjectURL(uploaded) });
      apply(path);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Le fichier n’a pas pu être envoyé. Réessayez.",
      );
    } finally {
      setUploading(null);
    }
  }

  async function toggleCartooniser(entry: DictItem, index: number) {
    if (entry.type !== "video" || !entry.path) return;
    if (entry.originalPath) {
      setEntry(index, { path: entry.originalPath, originalPath: undefined });
      setError("");
      setCartoonProgress(null);
      return;
    }
    const source = urls[entry.path];
    if (!source) {
      setError("La vidéo originale n’est pas disponible. Rechargez la page puis réessayez.");
      return;
    }
    const progressKey = `cartoon-${entry.id}`;
    setError("");
    setUploading(progressKey);
    setCartoonProgress({ key: progressKey, value: 10, label: "Chargement de la vidéo originale…" });
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error("La vidéo originale n’a pas pu être chargée.");
      const input = new File([await response.blob()], "video-originale.mp4", {
        type: response.headers.get("content-type") || "video/mp4",
      });
      setCartoonProgress({
        key: progressKey,
        value: 40,
        label: "Application du filtre dessin animé…",
      });
      const output = await cartooniseVideo(input);
      setCartoonProgress({
        key: progressKey,
        value: 85,
        label: "Enregistrement de la vidéo transformée…",
      });
      const cartoonPath = await uploadFile(output, folder);
      onUrls({ ...urls, [cartoonPath]: URL.createObjectURL(output) });
      setEntry(index, { path: cartoonPath, originalPath: entry.path, posterPath: undefined });
      setCartoonProgress({
        key: progressKey,
        value: 100,
        label: "Filtre appliqué. Enregistrez le dictionnaire pour confirmer.",
      });
    } catch (cause) {
      setCartoonProgress(null);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "La transformation en dessin animé a échoué.",
      );
    } finally {
      setUploading(null);
    }
  }

  const setEntry = (i: number, patch: Partial<DictItem>) =>
    set(
      "dictionary",
      draft.dictionary.map((e, j) => (j === i ? { ...e, ...patch } : e)),
    );

  const inline: InlineCtl | undefined =
    inlineProp ??
    (readOnly
      ? { editing: null, busy: false, onEdit: () => {}, onSave: () => {}, onCancel: () => {} }
      : undefined);
  const canEdit = !!inlineProp;
  const firstName = draft.name.trim().split(/\s+/)[0];
  const isEditing = (k: FieldKey) => !inline || inline.editing === k;

  /** A card section: full form when creating, read view + pencil on the profile page. */
  function Card(
    k: FieldKey,
    read: ReactNode,
    edit: ReactNode,
    title: ReactNode = <h2>{FIELD_LABELS[k]}</h2>,
  ) {
    if (!inline)
      return (
        <section className="bo-card">
          {title}
          {edit}
        </section>
      );
    const on = inline.editing === k;
    return (
      <section className={`bo-card${on ? " bo-card-editing" : ""}`}>
        <div className="bo-edit-head">
          {title}
          {canEdit && !on && <PencilBtn k={k} inline={inline} />}
        </div>
        {on ? (
          <>
            {edit}
            <EditBar k={k} inline={inline} />
          </>
        ) : (
          read
        )}
      </section>
    );
  }
  /** One line of the information list. */
  function Row(k: FieldKey, read: ReactNode, edit: ReactNode) {
    if (!inline) return edit;
    const on = inline.editing === k;
    return (
      <div className={`bo-read bo-read-edit${on ? " bo-card-editing" : ""}`}>
        <dt>{FIELD_LABELS[k]}</dt>
        <dd>
          {on ? (
            <>
              {edit}
              <EditBar k={k} inline={inline} />
            </>
          ) : (
            read || "—"
          )}
        </dd>
        {canEdit && !on && <PencilBtn k={k} inline={inline} />}
      </div>
    );
  }
  const list = (
    k:
      | "communicates"
      | "understandingNeeds"
      | "tools"
      | "facilitators"
      | "interests"
      | "dislikes"
      | "additional",
  ) =>
    Card(
      k,
      <ListEditor
        title={FIELD_LABELS[k]}
        items={draft[k]}
        onChange={() => {}}
        readOnly
        hideLegend
        keywords={k === "interests" || k === "dislikes"}
      />,
      <ListEditor
        title={FIELD_LABELS[k]}
        items={draft[k]}
        onChange={(l) => set(k, l)}
        readOnly={false}
        hideLegend={!!inline}
        keywords={k === "interests" || k === "dislikes"}
      />,
      inline ? <h2>{FIELD_LABELS[k]}</h2> : null,
    );

  const photoRead =
    draft.photoPath && urls[draft.photoPath] ? (
      <img
        className="bo-photo"
        src={urls[draft.photoPath]}
        alt={`Photo de ${firstName}`}
        style={{ objectPosition: `center ${draft.photoPositionY}%` }}
      />
    ) : (
      <p>Aucune photo.</p>
    );
  const dictRead =
    draft.dictionary.length === 0 ? (
      <p>Aucune entrée.</p>
    ) : (
      <DictionaryGrid
        entries={draft.dictionary.map((e) => ({
          ...e,
          alt: e.alt || e.title,
          source: urls[e.path] ?? "",
          poster: e.posterPath ? urls[e.posterPath] : undefined,
        }))}
      />
    );
  const dictEdit = isEditing("dictionary") ? (
    <>
      <p className="sr-only" role="status">
        {orderMessage}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Pour déplacer une entrée, appuyez sur Espace, utilisez les flèches, puis appuyez sur Espace pour confirmer ou Échap pour annuler.",
          },
          announcements: {
            onDragStart: () => "Déplacement de l’entrée commencé.",
            onDragOver: ({ over }) =>
              over
                ? `Position ${draft.dictionary.findIndex((e) => e.id === over.id) + 1}.`
                : "Hors de la liste.",
            onDragEnd: () => "Déplacement terminé.",
            onDragCancel: () => "Déplacement annulé.",
          },
        }}
        onDragEnd={({ active, over }) => {
          if (!over) return;
          moveEntry(
            draft.dictionary.findIndex((e) => e.id === active.id),
            draft.dictionary.findIndex((e) => e.id === over.id),
          );
        }}
      >
        <SortableContext items={draft.dictionary.map((e) => e.id)} strategy={rectSortingStrategy}>
          <div className="bo-dict-edit">
            {draft.dictionary.map((e, i) => (
              <SortableDictionaryEntry
                key={e.id}
                id={e.id}
                index={i}
                count={draft.dictionary.length}
                title={`Entrée ${i + 1}${e.path ? ` · ${kindLabel[e.type]}` : ""}`}
                onMove={moveEntry}
              >
                {e.path && urls[e.path] && (
                  <div className="bo-dict-preview">
                    <DictionaryCard
                      entry={{
                        ...e,
                        alt: e.alt || e.title,
                        source: urls[e.path] ?? "",
                        poster: e.posterPath ? urls[e.posterPath] : undefined,
                      }}
                    />
                  </div>
                )}
                <label className="bo-btn bo-btn-outline bo-file">
                  <Upload aria-hidden="true" />{" "}
                  {uploading === e.id
                    ? "Envoi en cours…"
                    : e.path
                      ? "Remplacer le fichier"
                      : "Choisir un fichier (image, GIF, vidéo ou son)"}
                  <input
                    type="file"
                    accept="image/*,video/*,audio/*"
                    className="sr-only"
                    onChange={(ev) => {
                      const f = ev.target.files?.[0];
                      const t = f ? mediaTypeFromFile(f) : null;
                      handleUpload(
                        f,
                        e.id,
                        (p) =>
                          setEntry(i, {
                            path: p,
                            type: t ?? "image",
                            originalPath: undefined,
                            posterPath: undefined,
                          }),
                        (file) => !!mediaTypeFromFile(file),
                      );
                    }}
                  />
                </label>
                <p className="bo-hint">
                  Images : 15 Mo · Sons (MP3, M4A, WAV, OGG, Opus, FLAC…) : 30 Mo · Vidéos : 100 Mo.
                  Les fichiers audio et vidéo ne sont pas recompressés lors de l’envoi.
                </p>
                {canCartoonise && e.type === "video" && e.path && (
                  <button
                    type="button"
                    className={`bo-cartoonise-button${e.originalPath ? " is-active" : ""}`}
                    disabled={uploading === `cartoon-${e.id}`}
                    aria-pressed={!!e.originalPath}
                    aria-label={
                      e.originalPath
                        ? "Retirer le filtre dessin animé"
                        : "Appliquer le filtre dessin animé"
                    }
                    title={
                      e.originalPath
                        ? "Retirer le filtre dessin animé"
                        : "Appliquer le filtre dessin animé"
                    }
                    onClick={() => void toggleCartooniser(e, i)}
                  >
                    <WandSparkles aria-hidden="true" />
                    <span>{e.originalPath ? "Retirer le filtre" : "Appliquer le filtre"}</span>
                  </button>
                )}
                {cartoonProgress?.key === `cartoon-${e.id}` && (
                  <div className="bo-media-progress" role="status" aria-live="polite">
                    <progress max="100" value={cartoonProgress.value}>
                      {cartoonProgress.value}%
                    </progress>
                    <span>
                      {cartoonProgress.label} ({cartoonProgress.value} %)
                    </span>
                  </div>
                )}
                <Field label="Signification (titre)">
                  <input
                    className="bo-input"
                    value={e.title}
                    onChange={(ev) => setEntry(i, { title: ev.target.value })}
                    placeholder="Par exemple : J’ai soif"
                  />
                </Field>
                <Field label="Explication">
                  <input
                    className="bo-input"
                    value={e.description}
                    onChange={(ev) => setEntry(i, { description: ev.target.value })}
                  />
                </Field>
                <Field
                  label="Description du média"
                  hint="Pour les personnes qui ne voient pas ou n’entendent pas."
                >
                  <input
                    className="bo-input"
                    value={e.alt}
                    onChange={(ev) => setEntry(i, { alt: ev.target.value })}
                  />
                </Field>
                {e.type === "audio" && (
                  <Field label="Transcription du son">
                    <input
                      className="bo-input"
                      value={e.transcript ?? ""}
                      onChange={(ev) => setEntry(i, { transcript: ev.target.value })}
                    />
                  </Field>
                )}
                <button
                  type="button"
                  className="bo-btn bo-btn-outline"
                  onClick={() =>
                    set(
                      "dictionary",
                      draft.dictionary.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" /> Supprimer cette entrée
                </button>
              </SortableDictionaryEntry>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        className="bo-btn bo-btn-outline"
        onClick={() =>
          set("dictionary", [
            ...draft.dictionary,
            {
              id: crypto.randomUUID(),
              type: "image",
              title: "",
              description: "",
              path: "",
              alt: "",
            },
          ])
        }
      >
        <Plus aria-hidden="true" /> Ajouter une entrée
      </button>
    </>
  ) : null;
  const photoEdit = (
    <>
      <div className="bo-photo-edit">
        {draft.photoPath && urls[draft.photoPath] ? (
          <img
            className="bo-photo"
            src={urls[draft.photoPath]}
            alt="Photo actuelle"
            style={{ objectPosition: `center ${draft.photoPositionY}%` }}
          />
        ) : (
          <div className="photo-placeholder">Pas de photo</div>
        )}
        <div className="bo-stack">
          <label className="bo-btn bo-btn-outline bo-file">
            <Upload aria-hidden="true" />{" "}
            {uploading === "photo"
              ? "Envoi en cours…"
              : draft.photoPath
                ? "Remplacer la photo"
                : "Choisir une photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) =>
                handleUpload(
                  e.target.files?.[0],
                  "photo",
                  (p) => set("photoPath", p),
                  (f) => f.type.startsWith("image/"),
                )
              }
            />
          </label>
          {draft.photoPath && (
            <button
              type="button"
              className="bo-btn bo-btn-outline"
              onClick={() => set("photoPath", null)}
            >
              Retirer la photo
            </button>
          )}
        </div>
      </div>
      {draft.photoPath && (
        <Field
          label="Cadrage vertical de la photo"
          hint="Déplacez le curseur pour choisir la partie visible du portrait."
        >
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={draft.photoPositionY}
            onChange={(e) => set("photoPositionY", Number(e.target.value))}
            aria-label="Position verticale de la photo"
          />
        </Field>
      )}
    </>
  );
  const text = (k: "howTo" | "about") => (
    <Field label="Texte">
      <textarea
        className="bo-input bo-textarea"
        value={draft[k]}
        onChange={(e) => set(k, e.target.value)}
      />
    </Field>
  );
  const input = (
    k: "name" | "birthDate" | "reminder" | "phone",
    label: string,
    type = "text",
    hint?: string,
  ) => (
    <Field label={label} hint={hint}>
      <input
        className="bo-input"
        type={type}
        max={k === "birthDate" ? new Date().toISOString().slice(0, 10) : undefined}
        inputMode={k === "phone" ? "tel" : undefined}
        autoComplete={k === "phone" ? "tel" : undefined}
        placeholder={k === "phone" ? "+41 79 123 45 67" : undefined}
        required={k === "name"}
        value={draft[k]}
        onChange={(e) => set(k, e.target.value)}
      />
    </Field>
  );
  const phoneEdit = (
    <>
      {input(
        "phone",
        "Téléphone suisse",
        "tel",
        "Mobile ou fixe : +41 79 123 45 67 ou 021 123 45 67.",
      )}
      <Field label="À propos du numéro" hint="Par exemple : Ma personne de confiance">
        <input
          className="bo-input"
          value={draft.phoneNote}
          onChange={(e) => set("phoneNote", e.target.value)}
        />
      </Field>
    </>
  );

  const info = inline ? (
    <section className="bo-card">
      <h2>Informations</h2>
      <dl className="bo-read-list">
        {Row("name", draft.name, input("name", "Nom (obligatoire)"))}
        {Row(
          "birthDate",
          draft.birthDate ? formatDateFr(draft.birthDate) : "",
          input("birthDate", "Date de naissance", "date"),
        )}
        {Row(
          "phone",
          draft.phone && (
            <>
              {draft.phone}
              {draft.phoneNote && ` (${draft.phoneNote})`}
            </>
          ),
          phoneEdit,
        )}
        {Row(
          "reminder",
          draft.reminder,
          input("reminder", "Message important", "text", "Affiché en évidence sous le profil."),
        )}
        <ReadValue label="Dernière mise à jour" value={formatDateFr(updatedAt)} />
      </dl>
    </section>
  ) : (
    <section className="bo-card">
      <h2>Informations</h2>
      <div className="bo-grid2">
        {input("name", "Nom (obligatoire)")}
        {input("birthDate", "Date de naissance", "date")}
        {phoneEdit}
        {input("reminder", "Message important", "text", "Affiché en évidence sous le profil.")}
      </div>
      <p className="bo-hint">
        Dernière mise à jour : {updatedAt ? formatDateFr(updatedAt) : "pas encore enregistré"} (mise
        à jour automatique à chaque enregistrement).
      </p>
    </section>
  );

  const visible = (key: PatientDraft["sectionOrder"][number]) => draft.sectionOrder.includes(key);
  const sectionManager = Card(
    "sectionOrder",
    <ol className="bo-section-order-read">
      {draft.sectionOrder.map((key) => (
        <li key={key}>{sectionTitle(key, draft.customSections)}</li>
      ))}
    </ol>,
    <SectionOrderEditor
      order={draft.sectionOrder}
      customSections={draft.customSections}
      onChange={(sectionOrder, customSections) =>
        onChange({ ...draft, sectionOrder, customSections })
      }
    />,
    <h2>Structure du passeport</h2>,
  );

  const steps: ProfileStep[] = [
    {
      id: "identite",
      label: "Identité",
      content: (
        <>
          {Card("photo", photoRead, photoEdit)}
          {Card("howTo", <p className="bo-pre">{draft.howTo || "—"}</p>, text("howTo"))}
          {Card("about", <p className="bo-pre">{draft.about || "—"}</p>, text("about"))}
          {info}
        </>
      ),
    },
  ];
  if (visible("dictionary"))
    steps.push({
      id: "dictionnaire",
      label: "Dictionnaire",
      content: Card("dictionary", dictRead, dictEdit),
    });
  const communication = (
    ["communicates", "understandingNeeds", "tools", "facilitators"] as const
  ).filter(visible);
  if (communication.length)
    steps.push({
      id: "communication",
      label: "Communication",
      content: (
        <>
          {communication.map((key) => (
            <Fragment key={key}>{list(key)}</Fragment>
          ))}
        </>
      ),
    });
  const preferences = (["interests", "dislikes"] as const).filter(visible);
  if (preferences.length)
    steps.push({
      id: "preferences",
      label: "Préférences",
      content: (
        <>
          {preferences.map((key) => (
            <Fragment key={key}>{list(key)}</Fragment>
          ))}
        </>
      ),
    });
  if (visible("additional"))
    steps.push({
      id: "autres",
      label: FIELD_LABELS.additional,
      content: list("additional"),
    });

  return (
    <>
      {error && (
        <p className="bo-error" role="alert">
          {error}
        </p>
      )}
      {!inline && (
        <div id="section-order" className="bo-builder-first">
          {sectionManager}
        </div>
      )}
      <Steps steps={steps} />
      {inline && <div id="section-order">{sectionManager}</div>}
    </>
  );
}
