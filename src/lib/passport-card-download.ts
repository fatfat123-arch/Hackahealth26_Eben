import { createPassportCardPdf, PASSPORT_CARD } from "./passport-card-pdf";

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

function loadArtwork(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("La mascotte n’a pas pu être chargée."));
    image.src = src;
  });
}

export async function downloadPassportCard({
  url,
  name,
  artwork,
}: {
  url: string;
  name: string;
  artwork: string;
}) {
  const image = await loadArtwork(artwork);
  const canvas = document.createElement("canvas");
  // About 305 dpi; native browser fonts preserve accents and non-Latin names.
  const scale = 12;
  canvas.width = PASSPORT_CARD.width * scale;
  canvas.height = PASSPORT_CARD.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("La carte n’a pas pu être préparée.");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PASSPORT_CARD.width, PASSPORT_CARD.height);
  const imageWidth = PASSPORT_CARD.width - 4;
  const imageHeight = (imageWidth * image.naturalHeight) / image.naturalWidth;
  ctx.drawImage(image, 2, 8, imageWidth, imageHeight);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(2, 2, 86, 12);
  ctx.fillRect(2, 65.5, 86, 3.5);
  ctx.fillStyle = "#004d95";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 3.8px Arial, sans-serif";
  ctx.fillText("Mon passeport de communication", 45, 6);
  let size = 4.4;
  const label = name.replace(/\s+/g, " ").trim();
  ctx.font = `bold ${size}px Arial, sans-serif`;
  while (size > 3 && ctx.measureText(label).width > 80) {
    size = Math.max(3, size - 0.1);
    ctx.font = `bold ${size}px Arial, sans-serif`;
  }
  let fitted = label;
  if (ctx.measureText(fitted).width > 80) {
    const characters = Array.from(label);
    while (characters.length && ctx.measureText(`${characters.join("")}…`).width > 80)
      characters.pop();
    fitted = `${characters.join("")}…`;
  }
  ctx.fillText(fitted, 45, 11.5);
  ctx.font = "bold 3.2px Arial, sans-serif";
  ctx.fillText("Scannez-moi", PASSPORT_CARD.qrX + PASSPORT_CARD.qrSize / 2, 24.5);
  ctx.font = "2.8px Arial, sans-serif";
  ctx.fillText("Pour mieux me connaître", 45, 67.4);
  ctx.strokeStyle = "#ffbf19";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(1, 1, 88, 68, 4);
  ctx.stroke();

  const bytes = await createPassportCardPdf(url, canvas.toDataURL("image/png"));
  const objectUrl = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = passportDownloadName(name, "carte-passeport", "pdf");
  document.body.append(link);
  link.click();
  link.remove();
  // Give browsers time to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
