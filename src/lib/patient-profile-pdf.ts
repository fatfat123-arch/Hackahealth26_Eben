import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PrintScaling, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type {
  PrintablePatientProfile,
  PrintableSectionKey,
  PrintableProfileBlock,
} from "./printable-patient-profile";

export type PatientProfilePdfAssets = {
  regular: Uint8Array;
  bold: Uint8Array;
  icons: Partial<Record<PrintableSectionKey, Uint8Array>>;
  portrait?: Uint8Array | undefined;
};

const PAGE_WIDTH = (210 * 72) / 25.4;
const PAGE_HEIGHT = (297 * 72) / 25.4;
const MARGIN = 32;
const WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = PAGE_HEIGHT - 42;
const GAP = 12;
const COLUMN_WIDTH = (WIDTH - GAP) / 2;
const PADDING = 12;
const BODY_SIZE = 12;
const LINE_HEIGHT = 16;
const ITEM_GAP = 4;
const HEADING_SIZE = 13;
const HEADING_LINE = 16;
const ICON_SIZE = 24;
const INK = rgb(0.12, 0.16, 0.2);
const BLUE = rgb(0, 0.25, 0.46);
const YELLOW = rgb(0.95, 0.73, 0.16);

/** Wrap explicit paragraphs and long words without dropping any printable characters. */
export function wrapPdfText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  const widths = new Map<string, number>();
  const fits = (value: string) => {
    let measured = widths.get(value);
    if (measured === undefined) {
      measured = font.widthOfTextAtSize(value, size);
      widths.set(value, measured);
    }
    return measured <= width;
  };
  for (const paragraph of text
    .replace(/\r\n?/g, "\n")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join("")
    .split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      if (fits(word)) {
        line = word;
        continue;
      }
      // Split an unbroken URL or long word at a character boundary.
      for (const character of Array.from(word)) {
        if (line && !fits(line + character)) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Composed A4 document, independent of the DOM and of public/private media URLs. */
export async function createPatientProfilePdf(
  profile: PrintablePatientProfile,
  assets: PatientProfilePdfAssets,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Profil de ${profile.name}`);
  pdf.setLanguage("fr-CH");
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(assets.regular, { subset: true }),
    pdf.embedFont(assets.bold, { subset: true }),
  ]);
  const icons = new Map(
    await Promise.all(
      profile.sections.map(async (section) => {
        const bytes = section.key ? assets.icons[section.key] : undefined;
        return [section.key, bytes ? await pdf.embedPng(bytes) : null] as const;
      }),
    ),
  );
  const portrait = assets.portrait ? await pdf.embedPng(assets.portrait) : null;
  let page: PDFPage;
  let top = MARGIN;
  const text = (
    value: string,
    x: number,
    at: number,
    size = BODY_SIZE,
    font = regular,
    color = INK,
  ) => {
    if (value) page.drawText(value, { x, y: PAGE_HEIGHT - at - size, size, font, color });
  };
  function roundedCard(x: number, at: number, width: number, height: number, warm = false) {
    const r = 10;
    page.drawSvgPath(
      `M ${r} 0 H ${width - r} Q ${width} 0 ${width} ${r} V ${height - r} Q ${width} ${height} ${width - r} ${height} H ${r} Q 0 ${height} 0 ${height - r} V ${r} Q 0 0 ${r} 0 Z`,
      {
        x,
        y: PAGE_HEIGHT - at,
        color: warm ? rgb(1, 0.98, 0.92) : rgb(0.95, 0.97, 0.99),
        borderColor: warm ? rgb(0.83, 0.75, 0.54) : rgb(0.76, 0.82, 0.86),
        borderWidth: 0.6,
      },
    );
  }
  type BodyLine = {
    value: string;
    bullet: boolean;
    item: number;
    itemLine: number;
    itemLength: number;
    height: number;
  };
  type CardLayout = {
    icon: ReturnType<typeof icons.get>;
    indent: number;
    headings: string[];
    headingHeight: number;
    lines: BodyLine[];
    overhead: number;
    height: number;
  };
  const measurements = new Map<PrintableProfileBlock, Map<string, CardLayout>>();
  function measure(section: PrintableProfileBlock, width: number, continued = false) {
    const cache = measurements.get(section) ?? new Map<string, CardLayout>();
    measurements.set(section, cache);
    const cacheKey = `${width}:${continued}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const icon = section.key ? icons.get(section.key) : null;
    const label = continued ? `${section.title} (suite)` : section.title;
    const indent = icon ? ICON_SIZE + 8 : 0;
    const headings = wrapPdfText(label, bold, HEADING_SIZE, width - PADDING * 2 - indent);
    const headingHeight = Math.max(icon ? ICON_SIZE : 0, headings.length * HEADING_LINE);
    const bodyWidth = width - PADDING * 2 - (section.bulleted ? 11 : 0);
    const lines: BodyLine[] = continued
      ? measure(section, width).lines
      : section.items.flatMap((item, itemIndex) => {
          const wrapped = wrapPdfText(item, regular, BODY_SIZE, bodyWidth);
          return wrapped.map((value, index) => ({
            value,
            bullet: section.bulleted && index === 0,
            item: itemIndex,
            itemLine: index,
            itemLength: wrapped.length,
            height:
              LINE_HEIGHT +
              (index === wrapped.length - 1 && itemIndex < section.items.length - 1 ? ITEM_GAP : 0),
          }));
        });
    const overhead = PADDING * 2 + headingHeight + 8;
    const layout = {
      icon,
      indent,
      headings,
      headingHeight,
      lines,
      overhead,
      height: overhead + lines.reduce((sum, line) => sum + line.height, 0),
    };
    cache.set(cacheKey, layout);
    return layout;
  }
  function drawCard(
    section: PrintableProfileBlock,
    x: number,
    at: number,
    width: number,
    layout: ReturnType<typeof measure>,
    lines = layout.lines,
  ) {
    const height = layout.overhead + lines.reduce((sum, line) => sum + line.height, 0);
    const warm = section.key === "interests" || section.title === "Important pour ma communication";
    roundedCard(x, at, width, height, warm);
    if (layout.icon) {
      const fitted = layout.icon.scaleToFit(ICON_SIZE, ICON_SIZE);
      page.drawImage(layout.icon, {
        x: x + PADDING + (ICON_SIZE - fitted.width) / 2,
        y: PAGE_HEIGHT - at - PADDING - (layout.headingHeight + fitted.height) / 2,
        ...fitted,
      });
    }
    layout.headings.forEach((line, index) =>
      text(
        line,
        x + PADDING + layout.indent,
        at + PADDING + index * HEADING_LINE,
        HEADING_SIZE,
        bold,
        BLUE,
      ),
    );
    let y = at + PADDING + layout.headingHeight + 8;
    for (const line of lines) {
      if (line.bullet)
        page.drawCircle({ x: x + PADDING + 2, y: PAGE_HEIGHT - y - 8, size: 1.8, color: BLUE });
      text(line.value, x + PADDING + (section.bulleted ? 11 : 0), y);
      y += line.height;
    }
    return height;
  }
  const contact = profile.information.find((block) => block.title === "Ma personne de contact");
  const contactWidth = WIDTH * 0.43;
  const contactLayout = contact ? measure(contact, contactWidth) : null;
  // Normal contacts belong with the identity. Very long contacts use a paginated card instead.
  const headerContact = contactLayout && contactLayout.height <= 160 ? contact : undefined;
  function newPage(first = false) {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    top = MARGIN;
    if (!first) {
      for (const line of wrapPdfText(profile.name, bold, 13, WIDTH)) {
        text(line, MARGIN, top, 13, bold, BLUE);
        top += 18;
      }
      top += 16;
      return;
    }
    text("Passeport de communication", MARGIN, top, 20, bold, BLUE);
    top += 34;
    const start = top;
    const photoSize = 76;
    const identityX = MARGIN + (portrait ? photoSize + 16 : 0);
    const contactX = PAGE_WIDTH - MARGIN - contactWidth;
    const identityWidth = (headerContact ? contactX - GAP : PAGE_WIDTH - MARGIN) - identityX;
    if (portrait) {
      roundedCard(MARGIN - 3, start - 3, photoSize + 6, photoSize + 6, true);
      page.drawImage(portrait, {
        x: MARGIN,
        y: PAGE_HEIGHT - start - photoSize,
        width: photoSize,
        height: photoSize,
      });
    }
    for (const line of wrapPdfText(profile.name, bold, 25, identityWidth)) {
      text(line, identityX, top, 25, bold, BLUE);
      top += 30;
    }
    top += 4;
    if (profile.age) {
      for (const line of wrapPdfText(`Âge : ${profile.age}`, regular, 12, identityWidth)) {
        text(line, identityX, top, 12);
        top += 16;
      }
    }
    if (profile.updatedAt) {
      for (const line of wrapPdfText(
        `Dernière mise à jour : ${profile.updatedAt}`,
        regular,
        10.5,
        identityWidth,
      )) {
        text(line, identityX, top, 10.5);
        top += 14;
      }
    }
    if (headerContact && contactLayout)
      drawCard(headerContact, contactX, start, contactWidth, contactLayout);
    top = Math.max(
      top,
      start + (portrait ? photoSize : 0),
      start + (headerContact ? contactLayout!.height : 0),
    );
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - top - 12 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - top - 12 },
      thickness: 2,
      color: YELLOW,
    });
    top += 26;
  }
  newPage(true);
  const blocks: PrintableProfileBlock[] = [
    ...profile.information.filter((block) => block !== headerContact),
    ...profile.sections,
  ];
  if (profile.introduction)
    blocks.push({
      title: "Comment utiliser cette page",
      items: [profile.introduction],
      bulleted: false,
    });
  const continuationTop = MARGIN + wrapPdfText(profile.name, bold, 13, WIDTH).length * 18 + 16;
  const fullPageSpace = BOTTOM - continuationTop;
  const isWide = (section: PrintableProfileBlock) =>
    measure(section, COLUMN_WIDTH).height > fullPageSpace * 0.35;

  /** Long cards use full width, continuing with their heading and without repeating item text. */
  function wideCard(section: PrintableProfileBlock, reserve: number) {
    const initial = measure(section, WIDTH);
    const lines = initial.lines;
    let index = 0;
    while (index < lines.length) {
      const layout = index === 0 ? initial : measure(section, WIDTH, true);
      const remainingHeight = lines.slice(index).reduce((sum, line) => sum + line.height, 0);
      const available = BOTTOM - top - reserve;
      const minimumLines = Math.min(2, lines.length - index);
      if (
        available < layout.overhead + minimumLines * LINE_HEIGHT ||
        (layout.overhead + remainingHeight <= fullPageSpace * 0.5 &&
          layout.overhead + remainingHeight > available)
      )
        newPage();
      const capacity = BOTTOM - top - reserve - layout.overhead;
      let end = index;
      let used = 0;
      while (end < lines.length && used + lines[end]!.height <= capacity) {
        used += lines[end]!.height;
        end++;
      }
      if (end < lines.length && end > index + 1) {
        const next = lines[end]!;
        const last = lines[end - 1]!;
        // Keep small list items intact and avoid single trailing paragraph lines.
        if (next.item === last.item) {
          const itemStart = end - last.itemLine - 1;
          if (itemStart > index && next.itemLength * LINE_HEIGHT <= fullPageSpace * 0.4)
            end = itemStart;
          else if (next.itemLine === next.itemLength - 1 && end > index + 2) end--;
        }
      }
      top += drawCard(section, MARGIN, top, WIDTH, layout, lines.slice(index, end)) + GAP;
      index = end;
      if (index < lines.length) newPage();
    }
  }
  for (let index = 0; index < blocks.length;) {
    const section = blocks[index]!;
    if (isWide(section)) {
      wideCard(section, index === blocks.length - 1 ? 30 : 0);
      index++;
      continue;
    }
    const next = blocks[index + 1];
    const pair = next && !isWide(next) ? next : undefined;
    // Reading order is left, right, then the next row, matching the saved section sequence.
    const width = pair ? COLUMN_WIDTH : WIDTH;
    const left = measure(section, width);
    const right = pair ? measure(pair, COLUMN_WIDTH) : null;
    const height = Math.max(left.height, right?.height ?? 0);
    const count = pair ? 2 : 1;
    const reserve = index + count === blocks.length ? 30 : 0;
    if (top + height + GAP + reserve > BOTTOM) newPage();
    drawCard(section, MARGIN, top, width, left);
    if (pair && right) drawCard(pair, MARGIN + COLUMN_WIDTH + GAP, top, COLUMN_WIDTH, right);
    top += height + GAP;
    index += count;
  }
  const closing = "Merci de prendre le temps de me comprendre.";
  if (top + 26 > BOTTOM) newPage();
  text(closing, MARGIN, top + 4, 12, bold, BLUE);
  const pages = pdf.getPages();
  if (pages.length > 1)
    pages.forEach((p, index) => {
      const label = `${index + 1} / ${pages.length}`;
      p.drawText(label, {
        x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(label, 9),
        y: 23,
        font: regular,
        size: 9,
        color: INK,
      });
    });
  return pdf.save();
}
