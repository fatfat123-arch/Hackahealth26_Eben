import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { NavigationIcon, type NavigationIconName } from "./navigation-icon";
import {
  CUSTOM_SECTION_ICONS,
  CUSTOM_SECTION_ICON_LABELS,
  SECTION_KEYS,
  defaultSectionOrder,
  sectionTitle,
  type CustomSection,
  type SectionId,
} from "@/lib/section-order";
import { moveDictionaryEntry } from "@/lib/dictionary-order";

export function SectionOrderEditor({
  order,
  customSections,
  onChange,
}: {
  order: SectionId[];
  customSections: CustomSection[];
  onChange: (order: SectionId[], customSections: CustomSection[]) => void;
}) {
  const hidden = SECTION_KEYS.filter((key) => !order.includes(key));

  function updateCustom(id: CustomSection["id"], patch: Partial<CustomSection>) {
    onChange(
      order,
      customSections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    );
  }

  function remove(id: SectionId) {
    onChange(
      order.filter((key) => key !== id),
      id.startsWith("custom:")
        ? customSections.filter((section) => section.id !== id)
        : customSections,
    );
  }

  function addCustom() {
    const section: CustomSection = {
      id: `custom:${crypto.randomUUID()}`,
      title: "Nouvelle section",
      icon: "info",
      items: [],
      display: "bullets",
    };
    onChange([...order, section.id], [...customSections, section]);
  }

  return (
    <div className="bo-section-manager">
      <p className="bo-hint">
        Ajoutez, masquez et organisez les sections du passeport. Les modifications seront visibles
        sur la page publique après l’enregistrement.
      </p>
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
                    <span>Icône</span>
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
              <span className="bo-section-order-ctl">
                <button
                  type="button"
                  className="bo-btn bo-btn-outline bo-icon-btn"
                  disabled={index === 0}
                  onClick={() =>
                    onChange(moveDictionaryEntry(order, index, index - 1), customSections)
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
                    onChange(moveDictionaryEntry(order, index, index + 1), customSections)
                  }
                  aria-label={`Descendre la section ${title}`}
                >
                  <ArrowDown aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="bo-btn bo-btn-outline bo-icon-btn bo-danger"
                  onClick={() => remove(id)}
                  aria-label={`Retirer la section ${title}`}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      {hidden.length > 0 && (
        <div className="bo-hidden-sections">
          <h3>Sections masquées</h3>
          <div className="bo-actions">
            {hidden.map((key) => (
              <button
                key={key}
                type="button"
                className="bo-btn bo-btn-outline"
                onClick={() => onChange([...order, key], customSections)}
              >
                <Plus aria-hidden="true" /> {sectionTitle(key, customSections)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bo-actions">
        <button type="button" className="bo-btn bo-btn-primary" onClick={addCustom}>
          <Plus aria-hidden="true" /> Ajouter une section personnalisée
        </button>
        <button
          type="button"
          className="bo-btn bo-btn-outline"
          onClick={() => onChange(defaultSectionOrder(), [])}
        >
          <RotateCcw aria-hidden="true" /> Rétablir les sections par défaut
        </button>
      </div>
    </div>
  );
}
