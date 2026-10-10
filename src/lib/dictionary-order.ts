export function moveDictionaryEntry<T>(entries: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) return entries;
  const next = [...entries];
  const moved = next.splice(from, 1);
  next.splice(to, 0, ...moved);
  return next;
}