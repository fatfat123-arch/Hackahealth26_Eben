import templateUrl from "@/assets/badges-reference.pdf?url&inline";
import nameFontUrl from "@/assets/fonts/Grandstander-ExtraBold.ttf?url";
import { getPatient } from "./patients.functions";
import { signPaths } from "./session";
import { publicPassportUrl } from "./site-url";
import { createPassportCardPdf, BADGE_TEMPLATE, patientFirstName } from "./passport-card-pdf";

export function passportDownloadName(name: string, prefix: string, extension: string) {
  const slug =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "profil";
  return `${prefix}-${slug}.${extension}`;
}

async function loadBytes(url: string, photo = false) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      ...(photo ? { cache: "no-store" as const } : {}),
    });
    if (!response.ok) throw new Error();
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new Error(
      photo
        ? "La photo du résident n’a pas pu être chargée. Réessayez."
        : "Le modèle des badges n’a pas pu être chargé. Réessayez.",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadPhoto(path: string) {
  const urls = await signPaths([path]);
  if (!urls[path]) throw new Error("La photo du résident n’a pas pu être chargée. Réessayez.");
  const bytes = await loadBytes(urls[path], true);
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
  } catch {
    throw new Error("La photo du résident n’a pas pu être chargée. Réessayez.");
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = Math.round(
      (canvas.width * BADGE_TEMPLATE.photo.height) / BADGE_TEMPLATE.photo.width,
    );
    const context = canvas.getContext("2d");
    if (!context) throw new Error("La photo du résident n’a pas pu être préparée.");
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
    const width = canvas.width / scale,
      height = canvas.height / scale;
    context.drawImage(
      image,
      (image.width - width) / 2,
      (image.height - height) / 2,
      width,
      height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("La photo du résident n’a pas pu être préparée.")),
        "image/png",
      ),
    );
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    image.close();
  }
}

/** Fresh authenticated profile and expiring media access, then a local PDF with embedded image bytes. */
export async function preparePassportCard(patientId: string) {
  const [patient, template, nameFont] = await Promise.all([
    getPatient({
      data: patientId,
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    }),
    loadBytes(templateUrl),
    loadBytes(nameFontUrl),
  ]);
  if (!patient) throw new Error("Le profil du résident est introuvable.");
  const photo = patient.photo_path ? await loadPhoto(patient.photo_path) : undefined;
  return {
    bytes: await createPassportCardPdf(publicPassportUrl(patient.public_id), patient.name, {
      template,
      nameFont,
      photo,
    }),
    filename: passportDownloadName(patientFirstName(patient.name), "carte", "pdf"),
  };
}

export async function downloadPassportCard({ patientId }: { patientId: string }) {
  const { bytes, filename } = await preparePassportCard(patientId);
  const objectUrl = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  try {
    link.href = objectUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}
