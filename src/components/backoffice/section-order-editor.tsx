import { ArrowDown, ArrowUp, ImagePlus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { NavigationIcon, type NavigationIconName } from "./navigation-icon";
import {
  CUSTOM_SECTION_ICONS,
  CUSTOM_SECTION_ICON_LABELS,
  SECTION_KEYS,
  defaultSectionOrder,
  sectionTitle,
  type CustomSection,
  type SectionId,
  type SectionIcons,
  type SectionKey,
} from "@/lib/section-order";
import { moveDictionaryEntry } from "@/lib/dictionary-order";
import { mediaFileError } from "@/lib/media-limits";

async function uploadIcon(file: File, folder: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("patientId", folder);
  const response = await fetch("/api/upload", { method: "POST", body });
  if (!response.ok) throw new Error(await response.text());
  return ((await response.json()) as { path: string }).path;
}

async function iconAsWebp(file: File) {
  if (!/^image\/(jpeg|png)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.88),
  );
  return blob
    ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" })
    : file;
}

export function SectionOrderEditor({
  order,
  customSections,
  sectionIcons,
  folder,
  urls,
  onUrls,
  onChange,
}: {
  order: SectionId[];
  customSections: CustomSection[];
  sectionIcons: SectionIcons;
  folder: string;
  urls: Record<string, string>;
  onUrls: (urls: Record<string, string>) => void;
  onChange: (
    order: SectionId[],
    customSections: CustomSection[],
    sectionIcons: SectionIcons,
  ) => void;
}) {
  const [uploading, setUploading] = useState<SectionId | null>(null);
  const [error, setError] = useState("");
  const availableTemplates = SECTION_KEYS.filter((key) => !order.includes(key));

  function updateCustom(id: CustomSection["id"], patch: Partial<CustomSection>) {
    onChange(
      order,
      customSections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
      sectionIcons,
    );
  }

  function remove(id: SectionId) {
    onChange(
      order.filter((key) => key !== id),
      id.startsWith("custom:")
        ? customSections.filter((section) => section.id !== id)
        : customSections,
      id.startsWith("custom:")
        ? sectionIcons
        : Object.fromEntries(Object.entries(sectionIcons).filter(([key]) => key !== id)),
    );
  }

  async function importIcon(id: SectionId, file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choisissez une image pour l’icône.");
      return;
    }
    const sizeError = mediaFileError(file);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    setError("");
    setUploading(id);
    try {
      const image = await iconAsWebp(file);
      const path = await uploadIcon(image, folder);
      onUrls({ ...urls, [path]: URL.createObjectURL(image) });
      if (id.startsWith("custom:")) updateCustom(id as CustomSection["id"], { iconPath: path });
      else onChange(order, customSections, { ...sectionIcons, [id]: path });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’icône n’a pas pu être importée.");
    } finally {
      setUploading(null);
    }
  }

  function addCustom() {
    const section: CustomSection = {
      id: `custom:${crypto.randomUUID()}`,
      title: "Nouvelle section",
      icon: "info",
      items: [],
      display: "bullets",
    };
    onChange([...order, section.id], [...customSections, section], sectionIcons);
  }

  function iconPath(id: SectionId, custom?: CustomSection) {
    return custom?.iconPath ?? sectionIcons[id as SectionKey];
  }

  return (
    <div className="bo-section-manager">
      <p className="bo-hint">
        Ajoutez, supprimez et organisez librement les sections du passeport. Vous pouvez choisir une
        icône proposée ou importer votre propre image. Les modifications seront visibles sur la page
        publique après l’enregistrement.
      </p>
      {error && <p className="bo-error">{error}</p>}
      <ol className="bo-section-order" aria-label="Sections affichées">
        {order.map((id, index) => {
          const custom = customSections.find((section) => section.id === id);
          const title = sectionTitle(id, customSections);
          return (
            <li key={id} className="bo-section-order-item bo-section-config-item">
              <span className="bo-section-order-num" aria-hidden="true">
                {index + 1}
              </span>
              {custom ? (
                <div className="bo-custom-section-fields">
                  <label className="bo-field">
                    <span>Titre de la section</span>
                    <input
                      className="bo-input"
                      value={custom.title}
                      maxLength={100}
                      onChange={(event) => updateCustom(custom.id, { title: event.target.value })}
                    />
                  </label>
                  <label className="bo-field">
                    <span>Icône proposée</span>
                    <span className="bo-icon-picker-row">
                      <NavigationIcon
                        name={custom.icon as NavigationIconName}
                        className="navigation-icon-small"
                      />
                      <select
                        className="bo-input"
                        value={custom.icon}
                        onChange={(event) =>
                          updateCustom(custom.id, {
                            icon: event.target.value as CustomSection["icon"],
                            iconPath: undefined,
                          })
                        }
                      >
                        {CUSTOM_SECTION_ICONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {CUSTOM_SECTION_ICON_LABELS[icon]}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <label className="bo-field bo-custom-section-content">
                    <span>Contenu — une information par ligne</span>
                    <textarea
                      className="bo-input"
                      rows={4}
                      value={custom.items.join("\n")}
                      onChange={(event) =>
                        updateCustom(custom.id, { items: event.target.value.split("\n") })
                      }
                    />
                  </label>
                  <label className="bo-field">
                    <span>Affichage</span>
                    <select
                      className="bo-input"
                      value={custom.display}
                      onChange={(event) =>
                        updateCustom(custom.id, {
                          display: event.target.value as CustomSection["display"],
                        })
                      }
                    >
                      <option value="bullets">Bulles</option>
                      <option value="keywords">Mots-clés</option>
                    </select>
                  </label>
                </div>
              ) : (
                <span className="bo-section-order-title">{title}</span>
              )}
              <div className="bo-section-icon-upload">
                {iconPath(id, custom) && urls[iconPath(id, custom)!] && (
                  <img src={urls[iconPath(id, custom)!]} alt="" className="navigation-icon-small" />
                )}
                <label className="bo-btn bo-btn-outline bo-file bo-btn-sm">
                  <ImagePlus aria-hidden="true" />
                  {uploading === id ? "Import…" : "Ma propre icône"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploading !== null}
                    onChange={(event) => void importIcon(id, event.target.files?.[0])}
                  />
                </label>
                {iconPath(id, custom) && (
                  <button
                    type="button"
                    className="bo-btn bo-btn-outline bo-icon-btn"
                    aria-label={`Retirer l’icône personnalisée de ${title}`}
                    title="Revenir à l’icône proposée"
                    onClick={() =>
                      custom
                        ? updateCustom(custom.id, { iconPath: undefined })
                        : onChange(
                            order,
                            customSections,
                            Object.fromEntries(
                              Object.entries(sectionIcons).filter(([key]) => key !== id),
                            ),
                          )
                    }
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>
              <span className="bo-section-order-ctl">
                <button
                  type="button"
                  className="bo-btn bo-btn-outline bo-icon-btn"
                  disabled={index === 0}
                  onClick={() =>
                    onChange(
                      moveDictionaryEntry(order, index, index - 1),
                      customSections,
                      sectionIcons,
                    )
                  }
                  aria-label={`Monter la section ${title}`}
                >
                  <ArrowUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="bo-btn bo-btn-outline bo-icon-btn"
                  disabled={index === order.length - 1}
                  onClick={() =>
                    onChange(
                      moveDictionaryEntry(order, index, index + 1),
                      customSections,
                      sectionIcons,
                    )
                  }
                  aria-label={`Descendre la section ${title}`}
                >
                  <ArrowDown aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="bo-btn bo-btn-outline bo-icon-btn bo-danger"
                  onClick={() => remove(id)}
                  aria-label={`Supprimer la section ${title}`}
                  title="Supprimer cette section"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="bo-actions">
        <button type="button" className="bo-btn bo-btn-primary" onClick={addCustom}>
          <Plus aria-hidden="true" /> Ajouter une section personnalisée
        </button>
        {availableTemplates.length > 0 && (
          <label className="bo-field bo-add-template">
            <span>Ajouter une rubrique prédéfinie</span>
            <select
              className="bo-input"
              value=""
              onChange={(event) => {
                const key = event.target.value as SectionKey;
                if (key) onChange([...order, key], customSections, sectionIcons);
              }}
            >
              <option value="">Choisir une rubrique…</option>
              {availableTemplates.map((key) => (
                <option key={key} value={key}>
                  {sectionTitle(key, customSections)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="bo-btn bo-btn-outline"
          onClick={() => onChange(defaultSectionOrder(), [], {})}
        >
          <RotateCcw aria-hidden="true" /> Rétablir les sections par défaut
        </button>
      </div>
    </div>
  );
}
