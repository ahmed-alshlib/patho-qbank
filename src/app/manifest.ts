import type { MetadataRoute } from "next";

/** Lets students install Rakeez on their phone's home screen. There is no offline mode:
 *  the app always loads from the network, it just opens in its own window like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rakeez — Medical Qbank",
    short_name: "Rakeez",
    description: "Question bank for medical students",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#02200d",
    theme_color: "#02200d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
