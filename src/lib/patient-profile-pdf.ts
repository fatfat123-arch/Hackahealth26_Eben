import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PageSizes, PrintScaling, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PrintablePatientProfile, PrintableSectionKey } from "./printable-patient-profile";

export type PatientProfilePdfAssets = {
  regular: Uint8Array;
  bold: Uint8Array;
  icons: Partial<Record<PrintableSectionKey, Uint8Array>>;
};

const [PAGE_WIDTH, PAGE_HEIGHT] = PageSizes.A4;
const MARGIN = 48;
const WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = PAGE_HEIGHT - 54;
const BODY_SIZE = 13;
const LINE_HEIGHT = 19;
const ITEM_GAP = 9;
const HEADING_SIZE = 17;
const INK = rgb(0.12, 0.16, 0.2);
const BLUE = rgb(0, 0.25, 0.46);

/** Wrap explicit paragraphs and long words without dropping any printable characters. */
export function wrapPdfText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      // Split an unbroken URL or long word at a character boundary.
      for (const character of Array.from(word)) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Composed A4 document, independent of the DOM and of public/private media URLs. */
export async function createPatientProfilePdf(profile: PrintablePatientProfile, assets: PatientProfilePdfAssets) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Profil de ${profile.name}`);
  pdf.setLanguage("fr-CH");
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(assets.regular, { subset: true }), pdf.embedFont(assets.bold, { subset: true }),
  ]);
  const icons = new Map(await Promise.all(profile.sections.map(async section => {
    const bytes = assets.icons[section.key];
    return [section.key, bytes ? await pdf.embedPng(bytes) : null] as const;
  })));
  let page: PDFPage;
  let top = MARGIN;
  const text = (value: string, x: number, at: number, size = BODY_SIZE, font = regular, color = INK) => {
    if (value) page.drawText(value, { x, y: PAGE_HEIGHT - at - size, size, font, color });
  };
  function newPage(first = false) {
    page = pdf.addPage(PageSizes.A4);
    top = MARGIN;
    if (first) {
      text("Profil", MARGIN, top, 10, regular, BLUE);
      top += 23;
      for (const line of wrapPdfText(profile.name, bold, 26, WIDTH)) {
        text(line, MARGIN, top, 26, bold, BLUE); top += 32;
      }
      page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - top - 7 }, end: { x: MARGIN + 46, y: PAGE_HEIGHT - top - 7 }, thickness: 3, color: rgb(0.95, 0.73, 0.16) });
      top += 30;
    } else {
      for (const line of wrapPdfText(profile.name, bold, 13, WIDTH)) { text(line, MARGIN, top, 13, bold, BLUE); top += 18; }
      page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - top - 5 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - top - 5 }, thickness: 0.6, color: rgb(0.7, 0.74, 0.78) });
      top += 23;
    }
  }
  function heading(section: PrintablePatientProfile["sections"][number], continued = false) {
    const label = continued ? `${section.title} (suite)` : section.title;
    const lines = wrapPdfText(label, bold, HEADING_SIZE, WIDTH - 56);
    const height = Math.max(46, lines.length * 22 + 20);
    page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - top - height, width: WIDTH, height, color: rgb(0.95, 0.97, 0.98) });
    page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - top - height, width: 3, height, color: BLUE });
    const icon = icons.get(section.key);
    if (icon) {
      const fitted = icon.scaleToFit(30, 30);
      page.drawImage(icon, { x: MARGIN + 12 + (30 - fitted.width) / 2, y: PAGE_HEIGHT - top - (height + fitted.height) / 2, ...fitted });
    }
    lines.forEach((line, index) => text(line, MARGIN + 52, top + 10 + index * 22, HEADING_SIZE, bold, BLUE));
    top += height + 13;
  }
  newPage(true);
  const bodyWidth = WIDTH - 29;
  for (const section of profile.sections) {
    const items = section.items.map(item => wrapPdfText(item, regular, BODY_SIZE, bodyWidth));
    const headingHeight = Math.max(46, wrapPdfText(section.title, bold, HEADING_SIZE, WIDTH - 56).length * 22 + 20) + 13;
    const height = headingHeight + items.reduce((sum, lines) => sum + lines.length * LINE_HEIGHT + ITEM_GAP, 0);
    const fullPageSpace = BOTTOM - (MARGIN + wrapPdfText(profile.name, bold, 13, WIDTH).length * 18 + 23);
    // Keep compact sections/items together; fill available space when a section is large.
    const firstItemHeight = items[0]!.length * LINE_HEIGHT;
    const minimum = headingHeight + (firstItemHeight <= fullPageSpace * 0.4 ? firstItemHeight : Math.min(2, items[0]!.length) * LINE_HEIGHT);
    if ((height <= fullPageSpace * 0.5 && top + height > BOTTOM) || top + minimum > BOTTOM) newPage();
    heading(section);
    for (const lines of items) {
      const itemHeight = lines.length * LINE_HEIGHT;
      const continuedHeadingHeight = Math.max(46, wrapPdfText(`${section.title} (suite)`, bold, HEADING_SIZE, WIDTH - 56).length * 22 + 20) + 13;
      if (top + itemHeight > BOTTOM && itemHeight <= Math.min(fullPageSpace * 0.4, fullPageSpace - continuedHeadingHeight)) {
        newPage(); heading(section, true);
      }
      let index = 0;
      let firstChunk = true;
      while (index < lines.length) {
        let capacity = Math.floor((BOTTOM - top) / LINE_HEIGHT);
        if (capacity < Math.min(2, lines.length - index)) { newPage(); heading(section, true); capacity = Math.floor((BOTTOM - top) / LINE_HEIGHT); }
        let count = Math.min(capacity, lines.length - index);
        // Do not leave a lone final line of a long item on the next page.
        if (lines.length - index - count === 1 && count > 2) count--;
        if (firstChunk) page!.drawCircle({ x: MARGIN + 11, y: PAGE_HEIGHT - top - 9, size: 2.3, color: INK });
        for (let offset = 0; offset < count; offset++) text(lines[index + offset]!, MARGIN + 26, top + offset * LINE_HEIGHT);
        top += count * LINE_HEIGHT;
        index += count;
        firstChunk = false;
        if (index < lines.length) { newPage(); heading(section, true); }
      }
      top += ITEM_GAP;
    }
    top += 13;
  }
  // An empty profile still has its name; no invented/empty sections are printed.
  const pages = pdf.getPages();
  if (pages.length > 1) pages.forEach((p, index) => {
    const label = `${index + 1} / ${pages.length}`;
    p.drawText(label, { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(label, 9), y: 29, font: regular, size: 9, color: INK });
  });
  return pdf.save();
}
