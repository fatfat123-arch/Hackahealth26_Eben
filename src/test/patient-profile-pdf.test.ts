import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { emptyDraft } from "@/lib/patients";
import { printablePatientProfile, patientProfileFilename } from "@/lib/printable-patient-profile";
import { createPatientProfilePdf } from "@/lib/patient-profile-pdf";

const file = (path: string) => new Uint8Array(readFileSync(resolve("src/assets", path)));
const assets = {
  regular: file("fonts/AtkinsonHyperlegible-Regular.ttf"),
  bold: file("fonts/AtkinsonHyperlegible-Bold.ttf"),
  icons: {
    interests: file("passport-interets.png"),
    dislikes: file("passport-peurs.png"),
    additional: file("icone-notes.png"),
  },
};

/** Read the actual PDF text using its embedded Unicode maps, without adding a PDF viewer dependency. */
async function inspectPdf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPages().map((page) => {
    const fontMaps = new Map<string, Map<string, string>>();
    const fonts = page.node.Resources()!.lookup(PDFName.of("Font"), PDFDict);
    for (const [key, ref] of fonts.entries()) {
      const font = pdf.context.lookup(ref, PDFDict);
      const unicode = font.lookup(PDFName.of("ToUnicode"));
      if (!(unicode instanceof PDFRawStream)) throw new Error("Missing embedded Unicode map");
      const cmap = new TextDecoder().decode(decodePDFRawStream(unicode).decode());
      const characters = new Map<string, string>();
      for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
        for (const pair of block[1]!.matchAll(/<([\da-f]+)>\s*<([\da-f]+)>/gi)) {
          characters.set(
            pair[1]!.toUpperCase(),
            String.fromCharCode(...pair[2]!.match(/.{4}/g)!.map((code) => parseInt(code, 16))),
          );
        }
      }
      fontMaps.set(key.decodeText(), characters);
    }
    const streams = page.node.Contents() as PDFArray;
    let text = "";
    for (const ref of streams.asArray()) {
      const stream = pdf.context.lookup(ref);
      if (!(stream instanceof PDFRawStream)) throw new Error("Missing PDF page content");
      const content = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      let font = "";
      for (const token of content.matchAll(/\/([^\s/]+)\s+[\d.]+\s+Tf|<([\da-f]+)>\s*Tj/gi)) {
        if (token[1]) font = token[1];
        else
          text +=
            token[2]!
              .match(/.{4}/g)!
              .map((code) => fontMaps.get(font)?.get(code.toUpperCase()) ?? "�")
              .join("") + "\n";
      }
    }
    const images =
      page.node.Resources()!.lookupMaybe(PDFName.of("XObject"), PDFDict)?.entries().length ?? 0;
    return { text, images, size: page.getSize() };
  });
  return { pdf, pages, text: pages.map((page) => page.text).join("\n") };
}

describe("Printable patient profile", () => {
  it("exports just the three nonempty selected sections in the saved order", async () => {
    const draft = {
      ...emptyDraft(),
      name: "Élodie Cœur Exemple",
      phone: "PRIVATE_PHONE",
      address: "PRIVATE_ADDRESS",
      interests: ["  J’aime écouter de la musique.  ", ""],
      dislikes: ["Les bruits soudains."],
      additional: ["Laissez-moi le temps de répondre."],
      dictionary: [
        {
          id: "private",
          title: "DICTIONARY_SECRET",
          type: "audio" as const,
          description: "SECRET_DESCRIPTION",
          path: "private/audio.mp3",
          alt: "SECRET_ALT",
        },
      ],
      sectionOrder: ["additional", "dictionary", "dislikes", "interests"] as const,
    };
    const profile = printablePatientProfile({ ...draft, sectionOrder: [...draft.sectionOrder] });
    expect(profile.sections.map((section) => section.key)).toEqual([
      "additional",
      "dislikes",
      "interests",
    ]);
    expect(Object.keys(profile)).toEqual(["name", "sections"]);
    const result = await inspectPdf(await createPatientProfilePdf(profile, assets));
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]!.images).toBe(3);
    expect(result.pages[0]!.size.width).toBeCloseTo(595.28, 1);
    expect(result.pages[0]!.size.height).toBeCloseTo(841.89, 1);
    for (const content of [
      draft.name,
      ...draft.interests.filter(Boolean).map((value) => value.trim()),
      ...draft.dislikes,
      ...draft.additional,
    ])
      expect(result.text).toContain(content);
    expect(result.text.indexOf("Autres informations")).toBeLessThan(
      result.text.indexOf("Mes peurs"),
    );
    expect(result.text.indexOf("Mes peurs")).toBeLessThan(result.text.indexOf("Mes centres"));
    for (const forbidden of [
      "Mon dictionnaire",
      "DICTIONARY_SECRET",
      "SECRET_DESCRIPTION",
      "private/audio.mp3",
      "PRIVATE_PHONE",
      "PRIVATE_ADDRESS",
      "Modifier",
      "Télécharger",
    ])
      expect(result.text).not.toContain(forbidden);
    expect(result.pdf.catalog.has(PDFName.of("Names"))).toBe(false);
  });

  it("omits blank sections, including on a completely empty profile", async () => {
    const draft = {
      ...emptyDraft(),
      name: "Julien Exemple",
      interests: [" ", "\n"],
      dislikes: [],
      additional: [],
    };
    const result = await inspectPdf(
      await createPatientProfilePdf(printablePatientProfile(draft), assets),
    );
    expect(result.pages).toHaveLength(1);
    expect(result.text).toContain(draft.name);
    expect(result.text).not.toMatch(/Mes centres|Mes peurs|Autres informations|Mon dictionnaire/);
    expect(result.pages[0]!.images).toBe(0);
  });

  it("paginates long profiles without losing text or making blank pages", async () => {
    const interests = Array.from(
      { length: 45 },
      (_, index) =>
        `Activité ${index + 1} : j’aime les promenades, écouter les oiseaux et prendre le temps de découvrir le jardin avec mon accompagnant.`,
    );
    const draft = {
      ...emptyDraft(),
      name: "Julien Exemple",
      interests,
      additional: ["FIN_DU_PROFIL"],
    };
    const result = await inspectPdf(
      await createPatientProfilePdf(printablePatientProfile(draft), assets),
    );
    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.pages.length).toBeLessThan(8);
    const joined = result.text.replace(/\s+/g, " ");
    for (const item of interests) expect(joined).toContain(item);
    expect(joined).toContain("FIN_DU_PROFIL");
    expect(result.text).not.toContain("Mon dictionnaire");
    for (const page of result.pages) expect(page.text.length).toBeGreaterThan(70);
  });

  it("keeps a very long item and unbroken words in the document", async () => {
    const paragraph = `${"Phrase longue avec des accents : été, cœur et forêt. ".repeat(180)}FIN_PARAGRAPHE`;
    const word = "https://exemple.ch/" + "abcdefghijk".repeat(80);
    const draft = { ...emptyDraft(), name: "Zoé Exemple", additional: [paragraph, word] };
    const result = await inspectPdf(
      await createPatientProfilePdf(printablePatientProfile(draft), assets),
    );
    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.text).toContain("FIN_PARAGRAPHE");
    expect(result.text.replace(/\s+/g, "")).toContain(word);
    expect(result.text.match(/cœur/g)).toHaveLength(180);
  });

  it("starts a nearly full-page section below the name rather than leaving the first page empty", async () => {
    const interests = Array.from(
      { length: 22 },
      (_, index) => `Activité ${index + 1} : écouter les oiseaux et découvrir le jardin.`,
    );
    const result = await inspectPdf(
      await createPatientProfilePdf(
        printablePatientProfile({ ...emptyDraft(), name: "Julien Exemple", interests }),
        assets,
      ),
    );
    expect(result.pages[0]!.text).toContain("Activité 1");
    expect(result.pages[0]!.text).toContain("Activité 20");
    expect(result.text).toContain("Activité 22");
  });

  it("uses a safe printable filename with the patient's current name", () => {
    expect(patientProfileFilename(" Élodie Exemple ")).toBe("Profil_Élodie_Exemple.pdf");
    expect(patientProfileFilename("../../Nom:patient")).toBe("Profil_Nom_patient.pdf");
    expect(patientProfileFilename("")).toBe("Profil_Patient.pdf");
  });
});
