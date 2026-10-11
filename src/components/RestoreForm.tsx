"use client";
import { useState } from "react";
import { restoreChunk } from "@/app/actions-backup";
import { BACKUP_FORMAT, BACKUP_TABLES } from "@/lib/backup";

type Parsed = { created: string; tables: Record<string, Record<string, unknown>[]> };
type Result = Record<string, { inserted: number; skipped: number; failed: number }>;
const LABEL: Record<string, string> = { subjects: "Subjects", chapters: "Chapters", summaries: "Summaries", topics: "Topics", questions: "Questions", answer_choices: "Answer choices", users: "Students", subscriptions: "Subscriptions", settings: "Settings", tests: "Sessions", test_questions: "Session questions", user_answers: "Answers", bookmarks: "Bookmarks", notes: "Notes", highlights: "Highlights", reported_questions: "Reports" };

export default function RestoreForm() {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function pick(file: File | undefined) {
    setParsed(null); setResult(null); setError(""); setName(file?.name ?? "");
    if (!file) return;
    try {
      const data = JSON.parse((await file.text()).replace(/^﻿/, ""));
      if (data?.format !== BACKUP_FORMAT || typeof data.tables !== "object") throw new Error("This is not a Rakeez backup file.");
      setParsed(data as Parsed);
    } catch (e) {
      setError(e instanceof SyntaxError ? "This file is not valid JSON, so it can't be a complete backup." : e instanceof Error ? e.message : "Could not read the file.");
    }
  }

  async function run() {
    if (!parsed) return;
    setBusy(true); setResult(null); setError("");
    const out: Result = {};
    try {
      for (const t of BACKUP_TABLES) {
        const rows = parsed.tables[t];
        if (!rows?.length) continue;
        out[t] = { inserted: 0, skipped: 0, failed: 0 };
        // Chunks stay well under the server's request size limit.
        let i = 0;
        while (i < rows.length) {
          let n = Math.min(500, rows.length - i);
          while (n > 1 && JSON.stringify(rows.slice(i, i + n)).length > 600_000) n = Math.floor(n / 2);
          setProgress(`${LABEL[t]}: ${Math.min(i + n, rows.length)} of ${rows.length}`);
          const r = await restoreChunk(t, rows.slice(i, i + n));
          out[t].inserted += r.inserted; out[t].skipped += r.skipped; out[t].failed += r.failed;
          i += n;
        }
      }
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore stopped. It is safe to run it again: rows already restored are skipped.");
      setResult(out);
    }
    setBusy(false); setProgress("");
  }

  const present = parsed ? BACKUP_TABLES.filter((t) => parsed.tables[t]?.length) : [];
  return (
    <div className="space-y-4" data-testid="restore">
      <input type="file" accept=".json,application/json" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} className="text-sm" data-testid="restore-file" />
      {error && <p className="rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad" role="alert">{error}</p>}
      {parsed && !result && (
        <div className="space-y-3 rounded-2xl border border-line p-4" data-testid="restore-summary">
          <p className="text-sm">Backup <b>{name}</b> made on <b>{new Date(parsed.created).toLocaleString("en")}</b> contains:</p>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{present.map((t) => <li key={t} className="flex justify-between"><span className="text-muted">{LABEL[t]}</span><b>{parsed.tables[t].length}</b></li>)}</ul>
          <p className="text-xs text-muted">Restoring only adds what is missing. Anything that already exists is skipped, and nothing is changed or deleted.</p>
          <button type="button" className="btn !py-2" onClick={run} disabled={busy} data-testid="restore-go">{busy ? "Restoring…" : "Restore now"}</button>
          {busy && <p className="text-sm text-muted" data-testid="restore-progress">{progress}</p>}
        </div>
      )}
      {result && (
        <div className="space-y-2 rounded-2xl border border-good/40 p-4" data-testid="restore-result">
          <p className="text-sm font-semibold text-good">Restore finished</p>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{Object.entries(result).map(([t, r]) => (
            <li key={t} className="flex justify-between gap-3"><span className="text-muted">{LABEL[t]}</span><span><b>{r.inserted}</b> added · {r.skipped} already there{r.failed ? <span className="text-bad"> · {r.failed} failed</span> : null}</span></li>))}</ul>
        </div>
      )}
    </div>
  );
}
