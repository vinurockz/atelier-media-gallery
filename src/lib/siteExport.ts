import type { MediaItem } from "@/types/media";
import type { Site, SitePage } from "@/types/website";
import { collectMediaIdsFromPage } from "@/lib/websiteBlocks";
import { BASE_STYLESHEET, renderSitePageDocument } from "@/lib/websiteRender";
import { extensionFromSrc, slugifyFilename } from "@/lib/zip";

// Loaded on demand, same reasoning as lib/zip.ts's loadJSZip — most visits never
// export a site, so this ~100KB dependency shouldn't be in the initial bundle.
async function loadJSZip() {
  const { default: JSZip } = await import("jszip");
  return JSZip;
}

/** URL-safe (not just filesystem-safe) slug — lib/zip.ts's slugifyFilename keeps
 * spaces/case for on-disk readability, which isn't what an exported page's folder
 * name/URL should look like. */
function urlSlug(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page"
  );
}

function pathForPage(page: SitePage, homeId: string | undefined): string {
  if (page.id === homeId) return "index.html";
  const slug = page.slug.trim() ? urlSlug(page.slug) : urlSlug(page.title);
  return `${slug}/index.html`;
}

/**
 * Exports a site's pages as a self-contained static `.zip` — real `index.html` files,
 * one shared `styles.css`, and every referenced image/video copied into `assets/` with
 * its `/api/media/:id/file` reference rewritten to a relative path, so the result opens
 * correctly straight from disk with no dependency on this app's server. Follows the
 * exact lazy-JSZip + anchor-click-download pattern already used in lib/zip.ts.
 */
export async function exportSiteAsZip(
  site: Site,
  pages: SitePage[],
  mediaItems: MediaItem[],
): Promise<void> {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  const sorted = [...pages].sort((a, b) => a.index - b.index);
  const homeId = sorted[0]?.id;

  // 1. Collect every unique media id referenced across every page.
  const mediaIds = new Set<string>();
  for (const page of sorted) {
    collectMediaIdsFromPage(page).forEach((id) => mediaIds.add(id));
  }

  // 2. Fetch + write each asset, building mediaId -> "assets/<file>".
  const assetPathById = new Map<string, string>();
  const usedNames = new Set<string>();
  await Promise.all(
    Array.from(mediaIds).map(async (id) => {
      const item = mediaItems.find((m) => m.id === id);
      if (!item) return;
      const response = await fetch(item.src);
      const blob = await response.blob();
      const ext = extensionFromSrc(item.src);
      let filename = `${slugifyFilename(item.title)}.${ext}`;
      let n = 2;
      while (usedNames.has(filename.toLowerCase())) {
        filename = `${slugifyFilename(item.title)}-${n}.${ext}`;
        n++;
      }
      usedNames.add(filename.toLowerCase());
      zip.file(`assets/${filename}`, blob);
      assetPathById.set(id, `assets/${filename}`);
    }),
  );

  // 3. Shared base stylesheet at the zip root.
  zip.file("styles.css", BASE_STYLESHEET);

  // 4. Per-page HTML — the home page (lowest index) sits at the zip root; every other
  // page gets its own single-level `<slug>/index.html`, so "../" is always the correct
  // way back to the root from a non-home page, and "" is always correct from home.
  for (const page of sorted) {
    const prefix = page.id === homeId ? "" : "../";
    const html = renderSitePageDocument(
      page,
      {
        resolveMediaUrl: (mediaId) => {
          const path = assetPathById.get(mediaId);
          return path ? `${prefix}${path}` : "";
        },
        resolveInternalLink: (targetPageId, url) => {
          if (targetPageId) {
            const target = sorted.find((p) => p.id === targetPageId);
            if (target) return `${prefix}${pathForPage(target, homeId)}`;
          }
          return url || "#";
        },
      },
      { stylesHref: `${prefix}styles.css` },
    );
    zip.file(pathForPage(page, homeId), html);
  }

  // 5. Download — identical tail to every lib/zip.ts export function.
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyFilename(site.name)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
