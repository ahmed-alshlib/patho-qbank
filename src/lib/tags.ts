/** Tags are stored as one comma-separated string per question (e.g. "Final 10/2022, Midterm 03/2023"). */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * One spelling per exam. Papers were tagged by different people over the years, so the same exam
 * arrives as "Mid 1/2022", "Mid 01/2022", "Mid/January 2022" or "Final Jan/2026". All of them
 * become "Midterm 01/2022" / "Final 01/2026". Anything that is not an exam tag is left as written.
 */
export const normalizeTag = (raw: string): string => {
  const s = raw.replace(/\s+/g, " ").trim();
  const m = s.match(/^(mid(?:[\s-]?term)?|final)\s*[/\-:]?\s*([a-z]+|\d{1,2})\s*[/\-.\s]\s*((?:19|20)\d{2})$/i);
  if (!m) return s;
  const month = /^\d+$/.test(m[2]) ? Number(m[2]) : MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!month || month < 1 || month > 12) return s;
  const kind = m[1].toLowerCase().startsWith("final") ? "Final" : "Midterm";
  return `${kind} ${String(month).padStart(2, "0")}/${m[3]}`;
};

export const parseTags = (s: string | null | undefined): string[] =>
  Array.from(new Set((s ?? "").split(/[,،;]/).map((t) => normalizeTag(t)).filter(Boolean)));

/** Newest exam first (by year, then month), then alphabetical. */
export const sortTags = (tags: string[]): string[] => {
  const when = (t: string) => {
    const m = t.match(/(\d{1,2})\/((?:19|20)\d{2})/);
    if (m) return Number(m[2]) * 100 + Number(m[1]);
    return Number((t.match(/(?:19|20)\d{2}/) ?? ["0"])[0]) * 100;
  };
  return [...tags].sort((a, b) => when(b) - when(a) || a.localeCompare(b));
};
