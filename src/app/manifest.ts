// Web app manifest, served at /manifest.webmanifest. Public. It makes Bloom
// installable as a PWA (standalone window, brand colours, icon). Built by
// Next.js at build time; contains no user data.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bloom",
    short_name: "Bloom",
    description:
      "Training und Ernährung, die sich an deine Daten anpassen – über den ganzen Zyklus.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf9",
    theme_color: "#e11d48",
    lang: "de",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
