import type { MetadataRoute } from "next";

/** Makes the Hub installable: Chrome and Edge show an Install button in the address bar when this is valid and the site is on HTTPS. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brand Creative Hub",
    short_name: "Creative Hub",
    description: "Briefs, assets and review, anchored to Jira",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FEFDFB",
    theme_color: "#08794A",
    icons: [
      { src: "/brand/monkey-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/monkey-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
