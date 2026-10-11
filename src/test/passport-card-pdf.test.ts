import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PDFDocument, PDFDict, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { createPassportCardPdf, patientFirstName } from "@/lib/passport-card-pdf";
import { passportDownloadName } from "@/lib/passport-card-download";
import { publicPassportUrl } from "@/lib/site-url";

const assets = {
  template: new Uint8Array(readFileSync("docs/badges-reference.pdf")),
  nameFont: new Uint8Array(readFileSync("src/assets/fonts/Grandstander-ExtraBold.ttf")),
};
const form = (pdf: PDFDocument, key: string) => {
  const stream = pdf
    .getPages()[0]!
    .node.Resources()!
    .lookup(PDFName.of("XObject"), PDFDict)
    .lookup(PDFName.of(key));
  if (!(stream instanceof PDFRawStream)) throw new Error("Missing template form");
  return stream;
};

describe("Reference badge sheet PDF", () => {
  it("bundles an exact copy of the reference template", () => {
    expect(
      createHash("sha256").update(readFileSync("src/assets/badges-reference.pdf")).digest("hex"),
    ).toBe(createHash("sha256").update(assets.template).digest("hex"));
  });
  it("keeps one exact A4 page, the original static artwork and embedded fonts", async () => {
    const original = await PDFDocument.load(assets.template);
    const result = await PDFDocument.load(
      await createPassportCardPdf(
        publicPassportUrl("reference-patient-1"),
        "Élodie Exemple",
        assets,
      ),
    );
    expect(result.getPageCount()).toBe(1);
    expect(result.getPages()[0]!.getSize()).toEqual({
      width: (210 * 72) / 25.4,
      height: (297 * 72) / 25.4,
    });
    for (const key of ["X32", "X33"])
      expect(decodePDFRawStream(form(result, key)).decode()).toEqual(
        decodePDFRawStream(form(original, key)).decode(),
      );
    // Static images remain the same embedded bytes, rather than being redrawn or rasterized.
    for (const key of ["X18", "X27", "X31"]) {
      const before = form(original, key)
        .dict.lookup(PDFName.of("Resources"), PDFDict)
        .lookup(PDFName.of("XObject"), PDFDict);
      const after = form(result, key)
        .dict.lookup(PDFName.of("Resources"), PDFDict)
        .lookup(PDFName.of("XObject"), PDFDict);
      for (const [name] of before.entries()) {
        const first = before.lookup(name),
          second = after.lookup(name);
        if (!(first instanceof PDFRawStream) || !(second instanceof PDFRawStream))
          throw new Error("Missing artwork");
        const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
        expect(digest(second.getContents())).toBe(digest(first.getContents()));
      }
    }
    const fonts = result.getPages()[0]!.node.Resources()!.lookup(PDFName.of("Font"), PDFDict);
    expect(fonts.entries().length).toBeGreaterThan(2);
    expect(result.getTitle()).toBe("Badges - Élodie");
  });

  it("removes placeholder text even when there is no portrait and fits a long first name", async () => {
    const name = "Marie-Alexandrine-Christophine";
    const result = await PDFDocument.load(
      await createPassportCardPdf(publicPassportUrl("reference-patient-2"), name, assets),
    );
    for (const key of ["X18", "X27", "X31"]) {
      const contents = new TextDecoder().decode(decodePDFRawStream(form(result, key)).decode());
      expect(contents).not.toMatch(/\/F12 (76|62) Tf/);
      expect(contents).not.toMatch(/\/F4 26 Tf/);
    }
    expect(result.getTitle()).toBe(`Badges - ${name}`);
    expect(result.getPageCount()).toBe(1);
  });

  it("rejects preview URLs and a changed template instead of generating incorrect badges", async () => {
    await expect(
      createPassportCardPdf("http://localhost:8080/passeport/test", "Test", assets),
    ).rejects.toThrow("publiée");
    const wrong = await PDFDocument.create();
    wrong.addPage();
    await expect(
      createPassportCardPdf(publicPassportUrl("test"), "Test", {
        ...assets,
        template: await wrong.save(),
      }),
    ).rejects.toThrow();
  });

  it("uses only the first name for a lowercase, accent-free filename", () => {
    expect(passportDownloadName(patientFirstName("  Élodie Exemple "), "carte", "pdf")).toBe(
      "carte-elodie.pdf",
    );
    expect(passportDownloadName(patientFirstName("Marie-Claire Exemple"), "carte", "pdf")).toBe(
      "carte-marie-claire.pdf",
    );
  });
});
