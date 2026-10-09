import type { DictionaryEntry } from "@/data/passport";
import type { PassportViewData } from "@/components/passport/passport-view";

export const MEDIA_BUCKET = "passport-media";

export type DictItem = {
  id: string;
  type: DictionaryEntry["type"];
  title: string;
  description: string;
  path: string;
  posterPath?: string;
  alt: string;
  transcript?: string;
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
  photoAlt: string;
  dictionary: DictItem[];
  interests: string[];
  dislikes: string[];
  additional: string[];
};

export type PatientRow = {
  id: string;
  name: string;
  birth_date: string | null;
  phone: string;
  phone_note: string;
  address: string;
  about: string;
  how_to: string;
  reminder: string;
  photo_path: string | null;
  photo_alt: string;
  dictionary: unknown;
  interests: string[];
  dislikes: string[];
  additional: string[];
  updated_at: string;
  created_by?: string | null;
};

export const emptyDraft = (): PatientDraft => ({
  name: "", birthDate: "", phone: "", phoneNote: "", address: "", about: "", howTo: "", reminder: "",
  photoPath: null, photoAlt: "", dictionary: [], interests: [], dislikes: [], additional: [],
});

export function rowToDraft(r: PatientRow): PatientDraft {
  return {
    name: r.name, birthDate: r.birth_date ?? "", phone: r.phone, phoneNote: r.phone_note, address: r.address,
    about: r.about, howTo: r.how_to, reminder: r.reminder, photoPath: r.photo_path, photoAlt: r.photo_alt,
    dictionary: Array.isArray(r.dictionary) ? (r.dictionary as DictItem[]) : [],
    interests: r.interests ?? [], dislikes: r.dislikes ?? [], additional: r.additional ?? [],
  };
}

export function draftToRow(d: PatientDraft) {
  const clean = (l: string[]) => l.map(s => s.trim()).filter(Boolean);
  return {
    name: d.name.trim(), birth_date: d.birthDate || null, phone: d.phone.trim(), phone_note: d.phoneNote.trim(),
    address: d.address.trim(), about: d.about.trim(), how_to: d.howTo.trim(), reminder: d.reminder.trim(),
    photo_path: d.photoPath, photo_alt: d.photoAlt.trim(), dictionary: d.dictionary.filter(e => e.path),
    interests: clean(d.interests), dislikes: clean(d.dislikes), additional: clean(d.additional),
  };
}

export function draftPaths(d: PatientDraft): string[] {
  const p: string[] = [];
  if (d.photoPath) p.push(d.photoPath);
  for (const e of d.dictionary) { if (e.path) p.push(e.path); if (e.posterPath) p.push(e.posterPath); }
  return p;
}

export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" }).format(d);
}

export function toViewData(d: PatientDraft, urls: Record<string, string>, updatedAt: string | null): PassportViewData {
  return {
    name: d.name || "Nom à compléter",
    birthDate: formatDateFr(d.birthDate || null),
    phone: d.phone,
    phoneHref: `tel:${d.phone.replace(/[^+\d]/g, "")}`,
    phoneNote: d.phoneNote,
    address: d.address || "—",
    updatedAt: updatedAt ? formatDateFr(updatedAt) : "Pas encore enregistré",
    updatedAtISO: updatedAt ?? "",
    portrait: d.photoPath ? urls[d.photoPath] : null,
    portraitAlt: d.photoAlt,
    about: d.about, howTo: d.howTo, reminder: d.reminder,
    dictionary: d.dictionary.filter(e => e.path).map(e => ({
      id: e.id, type: e.type, title: e.title, description: e.description, alt: e.alt || e.title,
      source: urls[e.path] ?? "", poster: e.posterPath ? urls[e.posterPath] : undefined, transcript: e.transcript,
    })),
    interests: d.interests.filter(Boolean), dislikes: d.dislikes.filter(Boolean), additional: d.additional.filter(Boolean),
  };
}

export function mediaTypeFromFile(file: File): DictItem["type"] | null {
  if (file.type === "image/gif") return "gif";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}
