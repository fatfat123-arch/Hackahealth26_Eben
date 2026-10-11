import regularUrl from "@/assets/fonts/AtkinsonHyperlegible-Regular.ttf?url";
import boldUrl from "@/assets/fonts/AtkinsonHyperlegible-Bold.ttf?url";
import { PRINTABLE_SECTION_ICONS } from "./printable-section-icons";
import { createPatientProfilePdf } from "./patient-profile-pdf";
import { patientProfileFilename, type PrintablePatientProfile } from "./printable-patient-profile";

async function assetBytes(url: string) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Une ressource du PDF n’a pas pu être chargée.");
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    window.clearTimeout(timer);
  }
}

export async function preparePatientProfilePdf(profile: PrintablePatientProfile) {
  const [regular, bold, icons] = await Promise.all([
    assetBytes(regularUrl),
    assetBytes(boldUrl),
    Promise.all(
      profile.sections.map(
        async (section) =>
          [section.key, await assetBytes(PRINTABLE_SECTION_ICONS[section.key])] as const,
      ),
    ),
  ]);
  return {
    bytes: await createPatientProfilePdf(profile, {
      regular,
      bold,
      icons: Object.fromEntries(icons),
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
