// Address of the published site. Fill in once the app is published (e.g. "https://mon-site.lovable.app").
export const PUBLISHED_ORIGIN = "";

export function isPreviewOrigin(origin: string) {
  return /id-preview--|lovableproject\.com|localhost|127\.0\.0\.1/.test(origin);
}

export function siteOrigin(): string {
  if (PUBLISHED_ORIGIN) return PUBLISHED_ORIGIN.replace(/\/$/, "");
  const o = typeof window !== "undefined" ? window.location.origin : "";
  return isPreviewOrigin(o) ? o.replace(/id-preview--/, "") : o;
}

export function publicPassportUrl(id: string) {
  return `${siteOrigin()}/passeport/${id}`;
}
