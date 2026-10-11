export const PUBLISHED_ORIGIN: string = "https://eh-passport.ch";

export function isPreviewOrigin(origin: string) {
  return /localhost|127\.0\.0\.1/.test(origin);
}

/** True when the link would point to a preview address because the published one is not known yet. */
export function linkUsesPreview(): boolean {
  return (
    !PUBLISHED_ORIGIN && typeof window !== "undefined" && isPreviewOrigin(window.location.origin)
  );
}

export function publicPassportUrl(id: string) {
  const origin = PUBLISHED_ORIGIN ? PUBLISHED_ORIGIN.replace(/\/$/, "") : window.location.origin;
  return `${origin}/passeport/${id}`;
}
