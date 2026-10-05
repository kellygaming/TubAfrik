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
    background_color: "#07070b",
    theme_color: "#07070b",
    lang: "fr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
