export const MEDIA_LIMITS = {
  image: 15 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
  video: 100 * 1024 * 1024,
} as const;

export type MediaKind = keyof typeof MEDIA_LIMITS;

export function mediaKind(type: string): MediaKind | null {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  return null;
}

export function mediaLimitLabel(kind: MediaKind) {
  return `${MEDIA_LIMITS[kind] / 1024 / 1024} Mo`;
}

export function mediaFileError(file: Pick<File, "size" | "type">) {
  const kind = mediaKind(file.type);
  if (!kind) return "Ce type de fichier n’est pas accepté.";
  if (file.size === 0) return "Le fichier est vide.";
  if (file.size > MEDIA_LIMITS[kind])
    return `Fichier trop volumineux : maximum ${mediaLimitLabel(kind)} pour ${kind === "image" ? "une image" : kind === "audio" ? "un son" : "une vidéo"}.`;
  return null;
}
