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

export const defaultSectionOrder = (): SectionKey[] => [...SECTION_KEYS];

/** Keeps known keys once, in the saved order, then appends any missing ones in default order. */
export function normalizeSectionOrder(order: unknown): SectionKey[] {
  const list = Array.isArray(order) ? order : [];
  const seen = new Set<SectionKey>();
  for (const k of list)
    if ((SECTION_KEYS as readonly string[]).includes(k) && !seen.has(k)) seen.add(k);
  for (const k of SECTION_KEYS) seen.add(k);
  return [...seen];
}
