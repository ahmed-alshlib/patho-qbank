"use client";
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "install-dismissed";

/** "Install Rakeez" banner. Android/desktop Chrome: one-tap install. iPhone Safari: how to add it
 *  from the Share menu. Hidden once installed, when already opened as an app, or after dismissing. */
export default function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === "1"; } catch {}
    if (standalone || dismissed) return;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) { setIos(true); setHidden(false); }
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIP); setHidden(false); };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (hidden || (!evt && !ios)) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, "1"); } catch {} };

  return (
    <div className="card mb-4 flex items-center gap-3 !p-4 text-sm" data-testid="install-prompt">
      <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Install Rakeez on your phone</div>
        <div className="text-xs text-muted">
          {ios ? <>Tap <Share className="-mt-0.5 inline h-3.5 w-3.5" /> Share, then <b>Add to Home Screen</b>.</> : "Open it from your home screen like an app."}
        </div>
      </div>
      {evt && (
        <button className="btn !px-3 !py-2 text-xs" onClick={async () => { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === "accepted") setHidden(true); setEvt(null); }}>
          <Download className="h-4 w-4" />Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="btn-ghost !p-2"><X className="h-4 w-4" /></button>
    </div>
  );
}
