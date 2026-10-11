import type { PatientDraft } from "./patients";
import { normalizeSectionOrder, SECTION_TITLES } from "./section-order";

export const PRINTABLE_SECTION_KEYS = ["interests", "dislikes", "additional"] as const;
export type PrintableSectionKey = (typeof PRINTABLE_SECTION_KEYS)[number];
export type PrintablePatientProfile = {
  name: string;
  sections: { key: PrintableSectionKey; title: string; items: string[] }[];
};

/** Explicit allowlist: dictionary, contact and account data never enter the PDF renderer. */
export function printablePatientProfile(draft: Pick<PatientDraft, "name" | "sectionOrder" | PrintableSectionKey>): PrintablePatientProfile {
  const keys = normalizeSectionOrder(draft.sectionOrder).filter((key): key is PrintableSectionKey =>
    (PRINTABLE_SECTION_KEYS as readonly string[]).includes(key));
  return {
    name: draft.name.trim(),
    sections: keys.map(key => ({ key, title: SECTION_TITLES[key], items: draft[key].map(item => item.trim()).filter(Boolean) }))
      .filter(section => section.items.length > 0),
  };
}

export function patientProfileFilename(name: string) {
  const safeName = name.normalize("NFC").replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").trim()
    .replace(/\s+/g, "_").replace(/^[._]+|[._]+$/g, "");
  return `Profil_${Array.from(safeName || "Patient").slice(0, 120).join("")}.pdf`;
}
