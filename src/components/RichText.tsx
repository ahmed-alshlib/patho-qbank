import React from "react";

/** Safe mini-formatter for summaries: # headings, - bullets, 1. lists, > notes, **bold**, *italic*, ==highlight==. No raw HTML is ever rendered. */
function inline(t: string): React.ReactNode[] {
  const out: React.ReactNode[] = []; const re = /(\*\*[^*]+\*\*|==[^=]+==|\*[^*\s][^*]*\*)/g; let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(t.slice(last, m.index));
    const x = m[0];
    if (x.startsWith("**")) out.push(<strong key={k++} className="font-semibold text-ink">{x.slice(2, -2)}</strong>);
    else if (x.startsWith("==")) out.push(<mark key={k++} className="rounded bg-warn/25 px-1 text-ink">{x.slice(2, -2)}</mark>);
    else out.push(<em key={k++}>{x.slice(1, -1)}</em>);
    last = m.index + x.length;
  }
  if (last < t.length) out.push(t.slice(last));
  return out;
}

export default function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: React.ReactNode[] = []; let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i]; const t = l.trim();
    if (!t) { i++; continue; }
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) {
      const lvl = m[1].length;
      blocks.push(<div key={k++} dir="auto" className={lvl === 1 ? "mt-8 border-b border-line pb-2 font-display text-2xl font-semibold" : lvl === 2 ? "mt-6 font-display text-xl font-semibold" : "mt-4 text-base font-semibold text-brand"}>{inline(m[2])}</div>);
      i++;
    } else if (/^[-*•]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, "")); i++; }
      blocks.push(<ul key={k++} dir="auto" className="my-3 list-disc space-y-1.5 ps-6 marker:text-brand">{items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>);
    } else if (/^\d+[.)]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++; }
      blocks.push(<ol key={k++} dir="auto" className="my-3 list-decimal space-y-1.5 ps-6 marker:font-semibold marker:text-brand">{items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ol>);
    } else if (t.startsWith(">")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) { items.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      blocks.push(<div key={k++} dir="auto" className="my-4 rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm">{inline(items.join(" "))}</div>);
    } else {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*•]\s|\d+[.)]\s|>)/.test(lines[i].trim())) { items.push(lines[i].trim()); i++; }
      blocks.push(<p key={k++} dir="auto" className="my-3 leading-7">{inline(items.join(" "))}</p>);
    }
  }
  return <div className="text-[15px] text-ink/90">{blocks}</div>;
}
