/** Tags are stored as one comma-separated string per question (e.g. "Final 10/2022, Mid 03/2023"). */
export const parseTags = (s: string | null | undefined): string[] =>
  Array.from(new Set((s ?? "").split(/[,،;]/).map((t) => t.trim()).filter(Boolean)));

/** Newest year first, then alphabetical. */
export const sortTags = (tags: string[]): string[] => {
  const year = (t: string) => Number((t.match(/(?:19|20)\d{2}/) ?? ["0"])[0]);
  return [...tags].sort((a, b) => year(b) - year(a) || a.localeCompare(b));
};
