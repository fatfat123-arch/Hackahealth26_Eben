import { PDFDocument, PrintScaling, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export const PASSPORT_CARD = { width: 90, height: 70, qrX: 48, qrY: 27.5, qrSize: 38.5 } as const;
const mm = (value: number) => (value * 72) / 25.4;
const blue = rgb(0, 77 / 255, 149 / 255);

/** A4 sheet with a 9 x 7 cm card. The real QR stays vector-sharp at any print resolution. */
export async function createPassportCardPdf(url: string, cardImage: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Carte - Passeport de communication");
  pdf.setLanguage("fr-CH");
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const page = pdf.addPage([mm(210), mm(297)]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const artwork = await pdf.embedPng(cardImage);
  const left = (210 - PASSPORT_CARD.width) / 2;
  const top = (297 - PASSPORT_CARD.height) / 2;
  const y = (fromTop: number) => mm(297 - fromTop);

  page.drawImage(artwork, {
    x: mm(left),
    y: y(top + PASSPORT_CARD.height),
    width: mm(PASSPORT_CARD.width),
    height: mm(PASSPORT_CARD.height),
  });

  // Four clear modules all around the QR: no artwork may enter this quiet zone.
  const quiet = 4;
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  const cell = PASSPORT_CARD.qrSize / (modules.size + quiet * 2);
  const qrLeft = left + PASSPORT_CARD.qrX;
  const qrTop = top + PASSPORT_CARD.qrY;
  page.drawRectangle({
    x: mm(qrLeft),
    y: y(qrTop + PASSPORT_CARD.qrSize),
    width: mm(PASSPORT_CARD.qrSize),
    height: mm(PASSPORT_CARD.qrSize),
    color: rgb(1, 1, 1),
  });
  for (let row = 0; row < modules.size; row++) {
    // Draw runs instead of separate squares to avoid seams when printed.
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue;
      const start = col;
      while (col + 1 < modules.size && modules.get(row, col + 1)) col++;
      page.drawRectangle({
        x: mm(qrLeft + (start + quiet) * cell),
        y: y(qrTop + (row + quiet + 1) * cell),
        width: mm((col - start + 1) * cell),
        height: mm(cell),
        color: blue,
      });
    }
  }

  // Crop marks sit outside the card and its QR quiet zone.
  for (const x of [left, left + PASSPORT_CARD.width]) {
    for (const t of [top, top + PASSPORT_CARD.height]) {
      const dx = x === left ? -1 : 1;
      const dy = t === top ? -1 : 1;
      page.drawLine({
        start: { x: mm(x + dx), y: y(t) },
        end: { x: mm(x + dx * 4), y: y(t) },
        thickness: 0.5,
        color: blue,
      });
      page.drawLine({
        start: { x: mm(x), y: y(t + dy) },
        end: { x: mm(x), y: y(t + dy * 4) },
        thickness: 0.5,
        color: blue,
      });
    }
  }
  const centerText = (text: string, fromTop: number, size: number) =>
    page.drawText(text, {
      x: (mm(210) - font.widthOfTextAtSize(text, size)) / 2,
      y: y(fromTop),
      font,
      size,
      color: blue,
    });
  centerText("Carte de passeport de communication - 9 x 7 cm", top - 10, 11);
  centerText(
    "Imprimez à 100 % (taille réelle), puis découpez aux repères.",
    top + PASSPORT_CARD.height + 12,
    10,
  );
  return pdf.save();
}
