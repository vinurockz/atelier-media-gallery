import type { MediaItem } from "@/types/media";

/**
 * The gallery's content comes straight from the filesystem:
 *
 *   src/assets/videos/<Category>/<file>.mp4|webm
 *   src/assets/videos/<Category>/_converted/<file>.mp4   (auto-generated, see scripts/convert-videos.mjs)
 *   src/assets/images/<Category>/<file>.{jpg,jpeg,png,webp,avif,gif}
 *
 * To assign a video or picture to a category, drop the file into that
 * category's folder (create the folder if it doesn't exist yet). No code
 * change needed — Vite's glob import below picks it up at build/dev time.
 *
 * Videos that aren't mp4/webm (mov, mkv, avi, wmv, mpg/mpt, ...) are
 * automatically transcoded to `_converted/<name>.mp4` by
 * `pnpm media:convert` (also runs before `dev`/`build`). Only the converted
 * output is shown in the gallery for those files.
 */

const videoModules = import.meta.glob<string>(
  "/src/assets/videos/*/*.{mp4,webm}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

const convertedVideoModules = import.meta.glob<string>(
  "/src/assets/videos/*/_converted/*.mp4",
  { eager: true, query: "?url", import: "default" },
);

const imageModules = import.meta.glob<string>(
  "/src/assets/images/*/*.{jpg,jpeg,png,webp,avif,gif}",
  { eager: true, query: "?url", import: "default" },
);

function titleFromFilename(path: string): string {
  const base = path.split("/").pop() ?? path;
  const withoutExt = base.replace(/\.[^.]+$/, "");
  return withoutExt
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildVideoItems(): MediaItem[] {
  const items: MediaItem[] = [];

  for (const [path, url] of Object.entries(videoModules)) {
    const match = /\/assets\/videos\/([^/]+)\/([^/]+)\.(mp4|webm)$/.exec(path);
    if (!match) continue;
    const [, category, name] = match;
    items.push({
      id: `video:${category}/${name}`,
      type: "video",
      title: titleFromFilename(name),
      category,
      src: url,
    });
  }

  for (const [path, url] of Object.entries(convertedVideoModules)) {
    const match = /\/assets\/videos\/([^/]+)\/_converted\/([^/]+)\.mp4$/.exec(
      path,
    );
    if (!match) continue;
    const [, category, name] = match;
    items.push({
      id: `video:${category}/${name}`,
      type: "video",
      title: titleFromFilename(name),
      category,
      src: url,
    });
  }

  return items;
}

function buildImageItems(): MediaItem[] {
  const items: MediaItem[] = [];

  for (const [path, url] of Object.entries(imageModules)) {
    const match = /\/assets\/images\/([^/]+)\/([^/]+)\.\w+$/.exec(path);
    if (!match) continue;
    const [, category, name] = match;
    items.push({
      id: `image:${category}/${name}`,
      type: "image",
      title: titleFromFilename(name),
      category,
      src: url,
    });
  }

  return items;
}

export const mediaItems: MediaItem[] = [
  ...buildVideoItems(),
  ...buildImageItems(),
].sort(
  (a, b) =>
    a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
);

export const categories: string[] = Array.from(
  new Set(mediaItems.map((item) => item.category)),
).sort((a, b) => a.localeCompare(b));
