import interests from "@/assets/passport-interets.png";
import dislikes from "@/assets/passport-peurs.png";
import additional from "@/assets/icone-notes.png";
import communicates from "@/assets/icone-communique.png";
import understandingNeeds from "@/assets/icone-comprendre.png";
import tools from "@/assets/icone-outils.png";
import facilitators from "@/assets/icone-faciliter.png";

/** The same pictograms in the passport and its printed profile. */
export const PRINTABLE_SECTION_ICONS = {
  communicates,
  understandingNeeds,
  tools,
  facilitators,
  interests,
  dislikes,
  additional,
} as const;
