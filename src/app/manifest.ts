import type { MetadataRoute } from "next";

// Installable depuis le navigateur, sans Play Store: l'appli « native »
// avant d'avoir une appli native.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TubAfrik",
    short_name: "TubAfrik",
    description: "Les shorts des gamers africains",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "fr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      // PNG en plus du SVG: certains Android n'installent l'appli qu'avec eux.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
