import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SitePage } from "@/types/website";
import {
  WebsitePageBlocks,
  type RenderContext,
} from "@/components/WebsitePageBlocks";
import { mediaFileUrl } from "@/lib/api/media";

/**
 * The same media/link resolution the editing canvas uses (SitePageCanvas.tsx) —
 * shared here so Preview mode can never drift from what the canvas already shows.
 * Export (lib/siteExport.ts) uses its own resolvers instead, since it needs
 * depth-aware relative paths and a localized asset map rather than live server URLs.
 */
export function createLiveRenderContext(pages: SitePage[]): RenderContext {
  return {
    resolveMediaUrl: (mediaId) => mediaFileUrl(mediaId),
    resolveInternalLink: (targetPageId, url) => {
      if (targetPageId) {
        const target = pages.find((p) => p.id === targetPageId);
        if (target) return target.slug ? `/${target.slug}/` : "/";
      }
      return url || "#";
    },
  };
}

/**
 * Base stylesheet for every exported/previewed page — a hand-written reset and font
 * stack, not Tailwind output, since there's no reliable way to extract Tailwind's
 * build-time JIT CSS as a static file at runtime from inside this SPA. Every block's
 * own visual appearance comes from its inline styles (see WebsitePageBlocks.tsx) —
 * this is just the baseline browser-default reset underneath them.
 */
export const BASE_STYLESHEET = `*{box-sizing:border-box;}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111827;line-height:1.5;}
a{color:inherit;}
img,video{max-width:100%;}
button,input,textarea,select{font-family:inherit;}
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders a full, standalone HTML document for one page — used identically by the
 * Preview iframe (`stylesHref` omitted, so the base stylesheet is inlined) and the zip
 * export (`stylesHref` set to a relative path to the shared styles.css written once at
 * the zip root). Uses `renderToStaticMarkup` (confirmed to resolve to react-dom's
 * browser build via its package.json `exports` "browser" condition, so this is safe to
 * call client-side) to render the exact same WebsitePageBlocks tree the editing canvas
 * uses, non-interactively — this is what guarantees editor/preview/export can never
 * visually disagree.
 */
export function renderSitePageDocument(
  page: SitePage,
  ctx: RenderContext,
  options?: { stylesHref?: string },
): string {
  const markup = renderToStaticMarkup(
    createElement(WebsitePageBlocks, { page, ctx }),
  );
  const styleTag = options?.stylesHref
    ? `<link rel="stylesheet" href="${options.stylesHref}">`
    : `<style>${BASE_STYLESHEET}</style>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title || "Untitled page")}</title>
${page.seoDescription ? `<meta name="description" content="${escapeHtml(page.seoDescription)}">\n` : ""}${styleTag}
</head>
<body>
${markup}
</body>
</html>`;
}
