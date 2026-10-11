// Carries the "profile saved" confirmation across the create → profile navigation.
let saved: string | null = null;
export const markJustSaved = (id: string) => {
  saved = id;
};
export const consumeJustSaved = (id: string) => {
  const ok = saved === id;
  if (ok) saved = null;
  return ok;
};
