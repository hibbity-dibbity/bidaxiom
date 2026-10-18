import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { ARTICLES } from "@/lib/articles";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/free-trial` },
    { url: `${SITE_URL}/knowledge-base` },
    ...ARTICLES.map((a) => ({ url: `${SITE_URL}/knowledge-base/${a.slug}` })),
  ];
}
