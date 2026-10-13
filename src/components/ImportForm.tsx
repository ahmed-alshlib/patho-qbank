"use client";
import { useState } from "react";
import { importJson } from "@/app/actions-content";

export type Tree = { name: string; chapters: { name: string; topics: string[] }[] }[];
const NEW = "__new";

function Pick({ label, value, onChange, newValue, onNew, options, fileLabel }: {
  label: string; value: string; onChange: (v: string) => void; newValue: string; onNew: (v: string) => void; options: string[]; fileLabel: string;
}) {
  return (
    <label className="block text-xs font-medium text-muted">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input mt-1 !py-2 text-sm">
        <option value="">{fileLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={NEW}>+ New…</option>
      </select>
      {value === NEW && <input value={newValue} onChange={(e) => onNew(e.target.value)} placeholder={`New ${label.toLowerCase()} name`} className="input mt-2 !py-2 text-sm" />}
    </label>
  );
}

export default function ImportForm({ tree, sample }: { tree: Tree; sample: string }) {
  const [s, setS] = useState(""), [sn, setSn] = useState("");
  const [c, setC] = useState(""), [cn, setCn] = useState("");
  const [t, setT] = useState(""), [tn, setTn] = useState("");
  const subj = tree.find((x) => x.name === s);
  const chap = subj?.chapters.find((x) => x.name === c);
  const val = (sel: string, nv: string) => (sel === NEW ? nv.trim() : sel);
  return (
    <form action={importJson} className="space-y-3">
      <p className="text-sm text-muted">Optional: choose where the questions go. Anything left on "From the file" uses the names written in the JSON. Questions that already exist are not duplicated: their new exam dates are added to the tags. Nothing is deleted.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Pick label="Subject" value={s} onChange={(v) => { setS(v); setC(""); setT(""); }} newValue={sn} onNew={setSn} options={tree.map((x) => x.name)} fileLabel="From the file" />
        <Pick label="Chapter" value={c} onChange={(v) => { setC(v); setT(""); }} newValue={cn} onNew={setCn} options={subj?.chapters.map((x) => x.name) ?? []} fileLabel="From the file" />
        <Pick label="Topic" value={t} onChange={setT} newValue={tn} onNew={setTn} options={chap?.topics ?? []} fileLabel="From the file" />
      </div>
      <input type="hidden" name="subject" value={val(s, sn)} /><input type="hidden" name="chapter" value={val(c, cn)} /><input type="hidden" name="topic" value={val(t, tn)} />
      <textarea name="json" rows={8} className="input font-mono text-xs" placeholder="Paste JSON here" />
      <div className="flex flex-wrap items-center gap-3"><input type="file" name="file" accept=".json,application/json" className="text-sm" /><button className="btn !py-2">Import</button></div>
      <details className="text-sm"><summary className="cursor-pointer font-medium text-brand">Show the format</summary><pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-raised p-3 text-xs">{sample}</pre></details>
    </form>
  );
}
