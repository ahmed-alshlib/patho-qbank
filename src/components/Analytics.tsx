"use client";
import { useEffect } from "react";
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let started = false;

/** Starts PostHog once in the browser. Does nothing until NEXT_PUBLIC_POSTHOG_KEY is set. */
export function AnalyticsInit() {
  useEffect(() => {
    if (!KEY || started) return;
    started = true;
    posthog.init(KEY, {
      api_host: "/ingest", // proxied through our own domain so ad blockers don't drop it
      ui_host: "https://eu.posthog.com",
      capture_pageview: "history_change",
      capture_pageleave: true,
      person_profiles: "identified_only",
      session_recording: { maskAllInputs: true, maskTextSelector: "[data-ph-mask]" },
    });
  }, []);
  return null;
}

/** Links the browser to the signed-in student by account ID only (no name or email). */
export function AnalyticsIdentify({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!KEY) return;
    const t = setTimeout(() => {
      // Remember who was identified, so logging out (landing on a login page) starts a fresh, anonymous visitor.
      try {
        if (userId) { if (posthog.get_distinct_id() !== userId) posthog.identify(userId); localStorage.setItem("ph_uid", "1"); }
        else if (localStorage.getItem("ph_uid")) { posthog.reset(); localStorage.removeItem("ph_uid"); }
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [userId]);
  return null;
}
