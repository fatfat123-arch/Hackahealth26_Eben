export const SECTION_KEYS = [
  "dictionary",
  "communicates",
  "understandingNeeds",
  "tools",
  "facilitators",
  "interests",
  "dislikes",
  "additional",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export type SectionId = SectionKey | `custom:${string}`;

export const CUSTOM_SECTION_ICONS = [
  "info",
  "idee",
  "objectif",
  "etoile",
  "coeur",
  "plante",
  "sourire",
  "ecoute",
  "message",
  "aide",
  "maison",
  "notes",
] as const;
export type CustomSectionIcon = (typeof CUSTOM_SECTION_ICONS)[number];
export const CUSTOM_SECTION_ICON_LABELS: Record<CustomSectionIcon, string> = {
  info: "Information",
  idee: "Idée",
  objectif: "Objectif",
  etoile: "Étoile",
  coeur: "Cœur",
  plante: "Évolution",
  sourire: "Bien-être",
  ecoute: "Écoute",
  message: "Communication",
  aide: "Aide",
  maison: "Maison",
  notes: "Notes",
};

export type CustomSection = {
  id: `custom:${string}`;
  title: string;
  icon: CustomSectionIcon;
  iconPath?: string | undefined;
  items: string[];
  display: "bullets" | "keywords";
};
export type SectionIcons = Partial<Record<SectionKey, string>>;

export const SECTION_TITLES: Record<SectionKey, string> = {
  dictionary: "Mon dictionnaire",
  communicates: "Je communique",
  understandingNeeds: "Ce dont j’ai besoin pour comprendre",
  tools: "Mes outils de communication",
  facilitators: "Ce qui facilite ma communication et la relation",
  interests: "Mes centres d’intérêt",
  dislikes: "Mes peurs / Ce que je n’aime pas",
  additional: "Autres informations",
};

export const defaultSectionOrder = (): SectionId[] => [...SECTION_KEYS];

function isSectionId(value: unknown): value is SectionId {
  return (
    typeof value === "string" &&
    ((SECTION_KEYS as readonly string[]).includes(value) || value.startsWith("custom:"))
  );
}

export function normalizeCustomSections(value: unknown): CustomSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<CustomSection>;
    if (typeof item.id !== "string" || !item.id.startsWith("custom:")) return [];
    const icon = CUSTOM_SECTION_ICONS.includes(item.icon as CustomSectionIcon)
      ? item.icon!
      : "info";
    return [
      {
        id: item.id as CustomSection["id"],
        title: typeof item.title === "string" ? item.title.slice(0, 100) : "Nouvelle section",
        icon,
        ...(typeof item.iconPath === "string" && item.iconPath ? { iconPath: item.iconPath } : {}),
        items: Array.isArray(item.items)
          ? item.items.filter((entry): entry is string => typeof entry === "string").slice(0, 100)
          : [],
        display: item.display === "keywords" ? "keywords" : "bullets",
      },
    ];
  });
}

/** Un tableau vide hérité signifie « ordre par défaut » ; un objet permet de masquer des sections. */
export function normalizeSectionConfiguration(value: unknown): {
  order: SectionId[];
  customSections: CustomSection[];
  sectionIcons: SectionIcons;
} {
  const legacy = Array.isArray(value);
  const source =
    !legacy && value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const customSections = normalizeCustomSections(source["customSections"]);
  const rawIcons =
    source["sectionIcons"] && typeof source["sectionIcons"] === "object"
      ? (source["sectionIcons"] as Record<string, unknown>)
      : {};
  const sectionIcons: SectionIcons = Object.fromEntries(
    SECTION_KEYS.flatMap((key) =>
      typeof rawIcons[key] === "string" && rawIcons[key] ? [[key, rawIcons[key]]] : [],
    ),
  );
  const validCustomIds = new Set(customSections.map((section) => section.id));
  const list = legacy ? value : Array.isArray(source["order"]) ? source["order"] : [];
  const seen = new Set<SectionId>();
  for (const key of list as unknown[])
    if (
      isSectionId(key) &&
      (!key.startsWith("custom:") || validCustomIds.has(key as CustomSection["id"])) &&
      !seen.has(key)
    )
      seen.add(key);
  if (legacy || !value) for (const key of SECTION_KEYS) seen.add(key);
  for (const section of customSections) if (!seen.has(section.id)) seen.add(section.id);
  return { order: [...seen], customSections, sectionIcons };
}

export function normalizeSectionOrder(order: unknown): SectionId[] {
  if (Array.isArray(order)) {
    const seen = new Set<SectionId>();
    for (const key of order) if (isSectionId(key) && !seen.has(key)) seen.add(key);
    return [...seen];
  }
  return normalizeSectionConfiguration(order).order;
}

export function sectionTitle(id: SectionId, customSections: CustomSection[]): string {
  if ((SECTION_KEYS as readonly string[]).includes(id)) return SECTION_TITLES[id as SectionKey];
  return customSections.find((section) => section.id === id)?.title || "Section personnalisée";
}

export function serializeSectionConfiguration(
  order: SectionId[],
  customSections: CustomSection[],
  sectionIcons: SectionIcons = {},
) {
  const custom = normalizeCustomSections(customSections);
  const customIds = new Set(custom.map((section) => section.id));
  const seen = new Set<SectionId>();
  for (const key of order)
    if (
      ((SECTION_KEYS as readonly string[]).includes(key) ||
        customIds.has(key as CustomSection["id"])) &&
      !seen.has(key)
    )
      seen.add(key);
  return { order: [...seen], customSections: custom, sectionIcons };
}
