import portrait from "@/assets/julien-portrait.jpg";
import thirst from "@/assets/soif.jpg";
import yesAnimation from "@/assets/oui.gif";
import yesStill from "@/assets/oui.jpg";
import tiredStill from "@/assets/fatigue.jpg";
import tiredVideo from "@/assets/fatigue.webm";
import attentionSound from "@/assets/attention.mp3";

export type DictionaryEntry = {
  id: string;
  title: string;
  description: string;
  type: "image" | "gif" | "video" | "audio";
  source: string;
  alt: string;
  poster?: string | undefined;
  transcript?: string | undefined;
};

export const passport = {
  name: "Julien Morel",
  birthDate: "14 mars 1998",
  phone: "+41 00 000 00 00",
  phoneHref: "tel:+41000000000",
  phoneNote: "Ma personne de confiance",
  address: "Rue des Tilleuls 12, 1004 Lausanne",
  updatedAt: "2 octobre 2026",
  updatedAtISO: "2026-10-02",
  portrait,
  portraitAlt: "Julien, souriant, dans un jardin",
  about: "Je suis Julien. Je suis une personne calme et curieuse, et j’aime rencontrer de nouvelles personnes. Je ne parle pas, mais je communique avec mes gestes, mes expressions et quelques sons. J’ai parfois besoin d’un peu de temps pour vous répondre.",
  howTo: "Cette page vous aide à comprendre ce que je souhaite vous dire. Découvrez mes gestes dans mon dictionnaire et ce qui est important pour moi dans les rubriques ci-dessous. Adressez-vous directement à moi, avec des phrases simples, et laissez-moi le temps de répondre.",
  reminder: "Je comprends beaucoup de choses, même si je ne parle pas. Parlez-moi comme à un adulte.",
  dictionary: [
    { id: "thirst", type: "image", title: "J’ai soif", description: "Je porte la main à ma bouche, comme pour boire.", source: thirst, alt: "Julien porte un verre d’eau à sa bouche" },
    { id: "yes", type: "gif", title: "Oui, je suis d’accord", description: "Je lève le pouce pour vous dire oui.", source: yesAnimation, poster: yesStill, alt: "Julien lève le pouce pour exprimer son accord" },
    { id: "tired", type: "video", title: "Je suis fatigué", description: "Je pose ma tête sur mes mains. J’ai besoin d’une pause.", source: tiredVideo, poster: tiredStill, alt: "Julien pose sa tête sur ses mains pour exprimer la fatigue" },
    { id: "attention", type: "audio", title: "J’appelle quelqu’un", description: "Je fais trois sons courts pour attirer votre attention.", source: attentionSound, alt: "Exemple sonore pour demander de l’attention", transcript: "Trois sons brefs, espacés : « mm, mm, mm »." },
  ] satisfies DictionaryEntry[],
  interests: ["Les promenades au bord du lac et dans la nature.", "Les trains : j’aime les regarder passer et visiter les gares.", "Écouter de la musique, surtout les chansons de Stromae.", "Les animaux, en particulier les chiens.", "Cuisiner un gâteau avec les personnes que j’aime."],
  dislikes: ["Les bruits soudains et forts, comme les sirènes ou les cris.", "Les endroits très fréquentés et les conversations trop rapides.", "Être touché sans qu’on me prévienne.", "Les changements de programme sans explication.", "Qu’on parle à ma place ou comme si je n’étais pas là."],
  additional: ["Posez-moi une seule question à la fois. Je peux répondre par oui ou non avec mes gestes.", "Si vous ne me comprenez pas, dites-le-moi simplement et proposez-moi de réessayer.", "Si je suis inquiet, un endroit calme et quelques minutes de pause m’aident.", "Ma personne de confiance peut vous aider si nous avons du mal à nous comprendre."],
};