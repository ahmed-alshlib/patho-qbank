import "server-only";
import { PostHog } from "posthog-node";

/**
 * Server-side PostHog events. Does nothing until NEXT_PUBLIC_POSTHOG_KEY is set in Vercel,
 * and never throws or slows a request down for more than a moment.
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";
let client: PostHog | null = null;

export async function track(userId: string, event: string, properties: Record<string, unknown> = {}) {
  if (!KEY) return;
  try {
    client ??= new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 });
    await Promise.race([
      client.captureImmediate({ distinctId: userId, event, properties }),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    // Analytics must never break the site.
  }
}
