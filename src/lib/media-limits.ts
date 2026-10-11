export const MEDIA_LIMITS = {
  image: 15 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
  video: 100 * 1024 * 1024,
} as const;

export type MediaKind = keyof typeof MEDIA_LIMITS;

const MEDIA_TYPES: Record<string, { kind: MediaKind; extension: string }> = {
  "image/jpeg": { kind: "image", extension: ".jpg" },
  "image/png": { kind: "image", extension: ".png" },
  "image/gif": { kind: "image", extension: ".gif" },
  "image/webp": { kind: "image", extension: ".webp" },
  "audio/mpeg": { kind: "audio", extension: ".mp3" },
  "audio/mp4": { kind: "audio", extension: ".m4a" },
  "audio/aac": { kind: "audio", extension: ".aac" },
  "audio/wav": { kind: "audio", extension: ".wav" },
  "audio/x-wav": { kind: "audio", extension: ".wav" },
  "audio/ogg": { kind: "audio", extension: ".ogg" },
  "audio/opus": { kind: "audio", extension: ".opus" },
  "audio/webm": { kind: "audio", extension: ".weba" },
  "audio/flac": { kind: "audio", extension: ".flac" },
  "video/mp4": { kind: "video", extension: ".mp4" },
  "video/quicktime": { kind: "video", extension: ".mov" },
  "video/webm": { kind: "video", extension: ".webm" },
};

export function mediaKind(type: string): MediaKind | null {
  return MEDIA_TYPES[type.toLowerCase()]?.kind ?? null;
}

export function mediaExtension(type: string) {
  return MEDIA_TYPES[type.toLowerCase()]?.extension ?? null;
}

function startsWith(bytes: Uint8Array, expected: number[], offset = 0) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

export async function mediaContentMatches(file: File) {
  const bytes = new Uint8Array(await new Response(file.slice(0, 16)).arrayBuffer());
  const type = file.type.toLowerCase();
  if (type === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (type === "image/png")
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/gif")
    return (
      startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
      startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    );
  if (type === "image/webp")
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    );
  if (type === "video/mp4" || type === "video/quicktime" || type === "audio/mp4")
    return startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4);
  if (type === "video/webm" || type === "audio/webm")
    return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if (type === "audio/mpeg")
    return (
      startsWith(bytes, [0x49, 0x44, 0x33]) ||
      (bytes[0] === 0xff && bytes[1] !== undefined && (bytes[1] & 0xe0) === 0xe0)
    );
  if (type === "audio/aac")
    return bytes[0] === 0xff && bytes[1] !== undefined && (bytes[1] & 0xf6) === 0xf0;
  if (type === "audio/wav" || type === "audio/x-wav")
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)
    );
  if (type === "audio/ogg" || type === "audio/opus")
    return startsWith(bytes, [0x4f, 0x67, 0x67, 0x53]);
  if (type === "audio/flac") return startsWith(bytes, [0x66, 0x4c, 0x61, 0x43]);
  return false;
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
