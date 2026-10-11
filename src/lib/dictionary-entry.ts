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
