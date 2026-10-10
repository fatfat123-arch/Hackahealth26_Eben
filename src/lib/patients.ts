import type { DictionaryEntry } from "@/data/passport";
import { defaultSectionOrder, normalizeSectionOrder, type SectionKey } from "@/lib/section-order";
import type { PassportViewData } from "@/components/passport/passport-view";

export const MEDIA_BUCKET = "passport-media";

export type DictItem = {
  id: string;
  type: DictionaryEntry["type"];
  title: string;
  description: string;
  path: string;
  originalPath?: string | undefined;
  posterPath?: string | undefined;
  alt: string;
  transcript?: string | undefined;
};

export type PatientDraft = {
  name: string;
  birthDate: string; // yyyy-mm-dd
  phone: string;
  phoneNote: string;
  address: string;
  about: string;
  howTo: string;
  reminder: string;
  photoPath: string | null;
  dictionary: DictItem[];
  communicates: string[];
  understandingNeeds: string[];
  tools: string[];
  facilitators: string[];
  interests: string[];
  dislikes: string[];
  additional: string[];
  sectionOrder: SectionKey[];
};

export type PatientRow = {
  id: string;
  name: string;
  age?: number | string | null;
  birth_date?: string | null;
  phone: string;
  phone_note: string;
  address: string;
  about: string;
  how_to: string;
  reminder: string;
  photo_path: string | null;
  dictionary: unknown;
  communicates?: string[];
  understanding_needs?: string[];
  tools?: string[];
  facilitators?: string[];
  interests: string[];
  dislikes: string[];
  additional: string[];
  section_order?: string[];
  updated_at: string;
  created_by?: string | null;
};

export const DEFAULT_HOW_TO = "Cette page vous aide à comprendre ce que je souhaite vous dire. Découvrez mes gestes dans mon dictionnaire et ce qui est important pour moi dans les rubriques ci-dessous. Adressez-vous directement à moi, avec des phrases simples, et laissez-moi le temps de répondre.";

export const emptyDraft = (): PatientDraft => ({
  name: "", birthDate: "", phone: "", phoneNote: "", address: "", about: "", howTo: DEFAULT_HOW_TO, reminder: "",
  photoPath: null, dictionary: [], communicates: [], understandingNeeds: [], tools: [], facilitators: [], interests: [], dislikes: [], additional: [], sectionOrder: defaultSectionOrder(),
});

export function rowToDraft(r: PatientRow): PatientDraft {
  return {
    name: r.name, birthDate: r.birth_date ?? "", phone: r.phone, phoneNote: r.phone_note, address: r.address,
    about: r.about, howTo: r.how_to, reminder: r.reminder, photoPath: r.photo_path,
    communicates: r.communicates ?? [], understandingNeeds: r.understanding_needs ?? [], tools: r.tools ?? [], facilitators: r.facilitators ?? [],
    dictionary: Array.isArray(r.dictionary) ? (r.dictionary as DictItem[]) : [],
    interests: r.interests ?? [], dislikes: r.dislikes ?? [], additional: r.additional ?? [],
    sectionOrder: normalizeSectionOrder(r.section_order),
  };
}

export function draftToRow(d: PatientDraft) {
  const clean = (l: string[]) => l.map(s => s.trim()).filter(Boolean);
  return {
    name: d.name.trim(), birth_date: d.birthDate || null, phone: d.phone.trim(), phone_note: d.phoneNote.trim(),
    address: d.address.trim(), about: d.about.trim(), how_to: d.howTo.trim(), reminder: d.reminder.trim(),
    photo_path: d.photoPath,
    communicates: clean(d.communicates), understanding_needs: clean(d.understandingNeeds), tools: clean(d.tools), facilitators: clean(d.facilitators), dictionary: d.dictionary.filter(e => e.path),
    interests: clean(d.interests), dislikes: clean(d.dislikes), additional: clean(d.additional),
    section_order: normalizeSectionOrder(d.sectionOrder),
  };
}

export function draftPaths(d: PatientDraft): string[] {
  const p: string[] = [];
  if (d.photoPath) p.push(d.photoPath);
  for (const e of d.dictionary) { if (e.path) p.push(e.path); if (e.originalPath) p.push(e.originalPath); if (e.posterPath) p.push(e.posterPath); }
  return p;
}

export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" }).format(d);
}

export function ageFromBirthDate(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  return age >= 0 && age <= 130 ? `${age} ans` : "—";
}

export function toViewData(d: PatientDraft, urls: Record<string, string>, updatedAt: string | null, publicAge?: string): PassportViewData {
  return {
    name: d.name || "Nom à compléter",
    age: publicAge ?? ageFromBirthDate(d.birthDate),
    phone: d.phone,
    phoneHref: `tel:${d.phone.replace(/[^+\d]/g, "")}`,
    phoneNote: d.phoneNote,
    contactName: "",
    contactRelationship: "",
    contactPhone: d.phone,
    address: d.address || "—",
    updatedAt: updatedAt ? formatDateFr(updatedAt) : "Pas encore enregistré",
    updatedAtISO: updatedAt ?? "",
    portrait: d.photoPath ? urls[d.photoPath] : null,
    portraitAlt: `Photo de ${(d.name.trim().split(/\s+/)[0]) || "la personne"}`,
    about: d.about, howTo: d.howTo, reminder: d.reminder,
    dictionary: d.dictionary.filter(e => e.path).map(e => ({
      id: e.id, type: e.type, title: e.title, description: e.description, alt: e.alt || e.title,
      source: urls[e.path] ?? "", poster: e.posterPath ? urls[e.posterPath] : undefined, transcript: e.transcript,
    })),
    communicates: d.communicates.filter(Boolean), understandingNeeds: d.understandingNeeds.filter(Boolean), tools: d.tools.filter(Boolean), facilitators: d.facilitators.filter(Boolean),
    interests: d.interests.filter(Boolean), dislikes: d.dislikes.filter(Boolean), additional: d.additional.filter(Boolean),
    sectionOrder: d.sectionOrder,
  };
}

export function mediaTypeFromFile(file: File): DictItem["type"] | null {
  if (file.type === "image/gif") return "gif";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}
