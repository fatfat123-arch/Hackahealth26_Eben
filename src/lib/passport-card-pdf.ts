import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFRawStream,
  PDFRef,
  PrintScaling,
  decodePDFRawStream,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  lineTo,
  appendBezierCurve,
  closePath,
  clip,
  endPath,
  type PDFObject,
  type PDFPage,
} from "pdf-lib";
import QRCode from "qrcode";
import { PUBLISHED_ORIGIN } from "./site-url";

const mm = (value: number) => (value * 72) / 25.4;
const BLUE = rgb(0.0471, 0.1961, 0.3686);
const BACKGROUND = rgb(0.9843, 0.9765, 0.9451);

/** Measured in PDF points from the original template; never scale or reposition its artwork. */
export const BADGE_TEMPLATE = {
  height: 841.92,
  qr: [
    { x: 206.8677, top: 330.42285, size: 56.86301 },
    { x: 208.28503, top: 538.76343, size: 52.32758 },
  ],
  names: [
    { x: 152.24409, baseline: 113.09646, width: 79.27958, size: 21.54331, centered: false },
    { x: 177.25542, baseline: 513.05316, width: 114.10161, size: 17.5748, centered: true },
  ],
  photo: { x: 74.5748, top: 104.59252, width: 65.19686, height: 85.03938, radius: 9.6378 },
} as const;

export function patientFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Patient";
}

export type PassportCardAssets = {
  template: Uint8Array;
  nameFont: Uint8Array;
  photo?: Uint8Array | undefined; // PNG bytes, center-cropped by the browser, never a media URL.
};

/** Remove only the five known placeholder text objects; all static text, vectors and images survive. */
function removePlaceholderText(pdf: PDFDocument, page: PDFPage) {
  const forms = page.node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
  const placeholders = {
    X18: ["F4:002A00510060006E0060", "F12:002A00690049005C005E005B"], // Photo, Prénom
    X27: ["F4:002C002D00A9004600600048004A"], // QR code
    X31: ["F12:002A00690049005C005E005B", "F4:002C002D00A9004600600048004A"],
  };
  for (const [key, expected] of Object.entries(placeholders)) {
    const ref = forms.get(PDFName.of(key));
    if (!(ref instanceof PDFRef)) throw new Error("Le modèle des badges n’est pas valide.");
    const stream = pdf.context.lookup(ref);
    if (!(stream instanceof PDFRawStream))
      throw new Error("Le modèle des badges n’est pas valide.");
    const removed = new Set<string>();
    const contents = new TextDecoder()
      .decode(decodePDFRawStream(stream).decode())
      .replace(/BT\b[\s\S]*?\bET/g, (block) => {
        const font = block.match(/\/(F\d+)\s+[\d.]+\s+Tf/)?.[1];
        const glyphs = Array.from(block.matchAll(/<([\da-f]+)>\s*Tj/gi), (match) => match[1])
          .join("")
          .toUpperCase();
        const signature = `${font}:${glyphs}`;
        if (!expected.includes(signature)) return block;
        removed.add(signature);
        return "";
      });
    if (removed.size !== expected.length)
      throw new Error("Le modèle des badges a changé. Vérifiez les zones à personnaliser.");
    const dictionary: Record<string, PDFObject> = {};
    for (const [name, value] of stream.dict.entries()) {
      if (!["Length", "Filter", "DecodeParms"].includes(name.decodeText()))
        dictionary[name.decodeText()] = value;
    }
    pdf.context.assign(ref, pdf.context.flateStream(contents, dictionary));
  }
}

function clipPhoto(page: PDFPage) {
  const { x, top, width: w, height: h, radius: r } = BADGE_TEMPLATE.photo;
  const y = BADGE_TEMPLATE.height - top - h;
  const k = r * 0.5522847498;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(x + r, y),
    lineTo(x + w - r, y),
    appendBezierCurve(x + w - r + k, y, x + w, y + r - k, x + w, y + r),
    lineTo(x + w, y + h - r),
    appendBezierCurve(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h),
    lineTo(x + r, y + h),
    appendBezierCurve(x + r - k, y + h, x, y + h - r + k, x, y + h - r),
    lineTo(x, y + r),
    appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y),
    closePath(),
    clip(),
    endPath(),
  );
}

/** Overlay the original five-badge sheet, preserving its embedded artwork and physical dimensions. */
export async function createPassportCardPdf(url: string, name: string, assets: PassportCardAssets) {
  const parsed = new URL(url);
  if (
    parsed.origin !== PUBLISHED_ORIGIN ||
    !/^\/passeport\/[A-Za-z0-9_-]+$/.test(parsed.pathname) ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("Le code QR doit utiliser l’adresse publique publiée du passeport.");
  const pdf = await PDFDocument.load(assets.template);
  if (pdf.getPageCount() !== 1) throw new Error("Le modèle doit contenir une seule page A4.");
  const page = pdf.getPages()[0]!;
  // Correct the source's rounded MediaBox to exact ISO A4, without scaling its contents.
  page.setSize(mm(210), mm(297));
  pdf.setTitle(`Badges - ${patientFirstName(name)}`);
  pdf.setLanguage("fr-CH");
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  removePlaceholderText(pdf, page);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(assets.nameFont, { subset: true });
  const firstName = patientFirstName(name);
  for (const area of BADGE_TEMPLATE.names) {
    const size = Math.min(
      area.size,
      (area.size * area.width) / font.widthOfTextAtSize(firstName, area.size),
    );
    const width = font.widthOfTextAtSize(firstName, size);
    page.drawText(firstName, {
      x: area.centered ? area.x + (area.width - width) / 2 : area.x,
      y: BADGE_TEMPLATE.height - area.baseline,
      font,
      size,
      color: BLUE,
    });
  }
  if (assets.photo) {
    const photo = await pdf.embedPng(assets.photo);
    const area = BADGE_TEMPLATE.photo;
    clipPhoto(page);
    page.drawImage(photo, {
      x: area.x,
      y: BADGE_TEMPLATE.height - area.top - area.height,
      width: area.width,
      height: area.height,
    });
    page.pushOperators(popGraphicsState());
  }
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  const quiet = 4;
  for (const area of BADGE_TEMPLATE.qr) {
    const cell = area.size / (modules.size + quiet * 2);
    if (cell < mm(0.3))
      throw new Error(
        "Le lien public est trop long pour imprimer un code QR lisible dans ce badge.",
      );
    // Erase the dashed frame and placeholder icon, with the template's exact background color.
    page.drawRectangle({
      x: area.x - 0.1,
      y: BADGE_TEMPLATE.height - area.top - area.size,
      width: area.size + 0.2,
      height: area.size + 0.1,
      color: BACKGROUND,
    });
    page.drawRectangle({
      x: area.x,
      y: BADGE_TEMPLATE.height - area.top - area.size,
      width: area.size,
      height: area.size,
      color: rgb(1, 1, 1),
    });
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (!modules.get(row, col)) continue;
        const start = col;
        while (col + 1 < modules.size && modules.get(row, col + 1)) col++;
        page.drawRectangle({
          x: area.x + (start + quiet) * cell,
          y: BADGE_TEMPLATE.height - area.top - (row + quiet + 1) * cell,
          width: (col - start + 1) * cell,
          height: cell,
          color: BLUE,
        });
      }
    }
  }
  return pdf.save();
}
