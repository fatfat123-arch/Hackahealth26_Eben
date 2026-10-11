import regularUrl from "@/assets/fonts/AtkinsonHyperlegible-Regular.ttf?url";
import boldUrl from "@/assets/fonts/AtkinsonHyperlegible-Bold.ttf?url";
import { PRINTABLE_SECTION_ICONS } from "./printable-section-icons";
import { createPatientProfilePdf } from "./patient-profile-pdf";
import { patientProfileFilename, type PrintablePatientProfile } from "./printable-patient-profile";

async function assetBytes(url: string, privateMedia = false) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      ...(privateMedia ? { cache: "no-store" as const } : {}),
    });
    if (!response.ok) throw new Error("Une ressource du PDF n’a pas pu être chargée.");
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    window.clearTimeout(timer);
  }
}

/** Rasterize supported browser image formats and retain the passport's saved portrait crop. */
async function portraitBytes(portrait: NonNullable<PrintablePatientProfile["portrait"]>) {
  const bytes = await assetBytes(portrait.url, true);
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("La photo n’a pas pu être préparée.");
    const crop = Math.min(bitmap.width, bitmap.height);
    const position = Math.min(100, Math.max(0, parseFloat(portrait.position) || 0)) / 100;
    context.drawImage(
      bitmap,
      (bitmap.width - crop) / 2,
      (bitmap.height - crop) * position,
      crop,
      crop,
      0,
      0,
      600,
      600,
    );
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Photo indisponible."))),
        "image/png",
      ),
    );
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

export async function preparePatientProfilePdf(profile: PrintablePatientProfile) {
  const [regular, bold, icons, portrait] = await Promise.all([
    assetBytes(regularUrl),
    assetBytes(boldUrl),
    Promise.all(
      profile.sections
        .filter((section) => section.key)
        .map(
          async (section) =>
            [section.key!, await assetBytes(PRINTABLE_SECTION_ICONS[section.key!])] as const,
        ),
    ),
    profile.portrait ? portraitBytes(profile.portrait) : undefined,
  ]);
  return {
    bytes: await createPatientProfilePdf(profile, {
      regular,
      bold,
      icons: Object.fromEntries(icons),
      portrait,
    }),
    filename: patientProfileFilename(profile.name),
  };
}

/** Short-lived browser blob only: no PDF endpoint, upload or permanent storage. */
export function savePatientProfilePdf({
  bytes,
  filename,
}: {
  bytes: Uint8Array;
  filename: string;
}) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
