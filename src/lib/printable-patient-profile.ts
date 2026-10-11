import type { PassportViewData } from "@/components/passport/passport-view";
import { DEFAULT_HOW_TO } from "./patients";
import { normalizeSectionOrder, SECTION_TITLES } from "./section-order";

export const PRINTABLE_SECTION_KEYS = [
  "communicates",
  "understandingNeeds",
  "tools",
  "facilitators",
  "interests",
  "dislikes",
  "additional",
] as const;
export type PrintableSectionKey = (typeof PRINTABLE_SECTION_KEYS)[number];
export type PrintableProfileBlock = {
  key?: PrintableSectionKey;
  title: string;
  items: string[];
  bulleted: boolean;
};
export type PrintablePatientProfile = {
  name: string;
  age: string;
  updatedAt: string;
  portrait: { url: string; position: string } | null;
  information: PrintableProfileBlock[];
  sections: PrintableProfileBlock[];
  introduction: string;
};

/** Project the displayed passport, excluding dictionary, account data and internal identifiers. */
export function printablePatientProfile(data: PassportViewData): PrintablePatientProfile {
  const clean = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
  const information = [
    {
      title: "Ma personne de contact",
      items: clean([data.contactName, data.contactRelationship, data.contactPhone, data.phoneNote]),
      bulleted: false,
    },
    { title: "À propos de moi", items: clean([data.about]), bulleted: false },
    { title: "Important pour ma communication", items: clean([data.reminder]), bulleted: false },
  ].filter((block) => block.items.length > 0);
  const order = normalizeSectionOrder(data.sectionOrder);
  return {
    name: data.name.trim(),
    age: data.age && data.age !== "—" ? data.age.trim() : "",
    updatedAt: data.updatedAtISO ? data.updatedAt : "",
    portrait: data.portrait
      ? { url: data.portrait, position: data.portraitPosition ?? "50%" }
      : null,
    information,
    sections: order
      .flatMap((id): PrintableProfileBlock[] => {
        if (id.startsWith("custom:")) {
          const section = (data.customSections ?? []).find((item) => item.id === id);
          return section
            ? [
                {
                  title: section.title.trim(),
                  items: clean(section.items),
                  bulleted: section.display === "bullets",
                },
              ]
            : [];
        }
        if (!(PRINTABLE_SECTION_KEYS as readonly string[]).includes(id)) return [];
        const key = id as PrintableSectionKey;
        return [
          {
            key,
            title: SECTION_TITLES[key],
            items: clean(data[key] ?? []),
            bulleted: true,
          },
        ];
      })
      .filter((section) => section.items.length > 0),
    // Keep the saved explanation; adapt only the shared default's dictionary-specific sentence.
    introduction:
      data.howTo.trim() === DEFAULT_HOW_TO
        ? DEFAULT_HOW_TO.replace(
            "Découvrez mes gestes dans mon dictionnaire et ce qui est important pour moi dans les rubriques ci-dessous.",
            "Les rubriques ci-dessous présentent ce qui est important pour moi.",
          )
        : data.howTo.trim(),
  };
}

export function patientProfileFilename(name: string) {
  const safeName = name
    .normalize("NFC")
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 || /[<>:"/\\|?*]/.test(character) ? "_" : character;
    })
    .join("")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");
  return `Profil_${Array.from(safeName || "Patient")
    .slice(0, 120)
    .join("")}.pdf`;
}
