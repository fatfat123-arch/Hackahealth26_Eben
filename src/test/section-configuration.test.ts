import { describe, expect, it } from "vitest";
import {
  SECTION_KEYS,
  normalizeSectionConfiguration,
  serializeSectionConfiguration,
  type CustomSection,
} from "@/lib/section-order";

describe("configuration des sections", () => {
  it("conserve le format historique et ajoute les sections manquantes", () => {
    const result = normalizeSectionConfiguration(["interests", "dictionary"]);
    expect(result.order.slice(0, 2)).toEqual(["interests", "dictionary"]);
    expect(result.order).toHaveLength(SECTION_KEYS.length);
  });

  it("respecte les sections standards retirées dans le nouveau format", () => {
    const result = normalizeSectionConfiguration({ order: ["dictionary"], customSections: [] });
    expect(result.order).toEqual(["dictionary"]);
  });

  it("enregistre une section personnalisée avec son icône et son contenu", () => {
    const custom: CustomSection = {
      id: "custom:test",
      title: "Mes habitudes",
      icon: "maison",
      items: ["J’aime commencer doucement"],
      display: "bullets",
    };
    const saved = serializeSectionConfiguration(["dictionary", custom.id], [custom]);
    expect(normalizeSectionConfiguration(saved)).toEqual({
      order: ["dictionary", custom.id],
      customSections: [custom],
      sectionIcons: {},
    });
  });

  it("conserve les icônes importées des sections standards et personnalisées", () => {
    const custom: CustomSection = {
      id: "custom:icon",
      title: "Mon quotidien",
      icon: "maison",
      iconPath: "patients/test/quotidien.webp",
      items: ["Une habitude"],
      display: "bullets",
    };
    const saved = serializeSectionConfiguration(["interests", custom.id], [custom], {
      interests: "patients/test/interets.webp",
    });
    expect(normalizeSectionConfiguration(saved)).toEqual({
      order: ["interests", custom.id],
      customSections: [custom],
      sectionIcons: { interests: "patients/test/interets.webp" },
    });
  });
});
