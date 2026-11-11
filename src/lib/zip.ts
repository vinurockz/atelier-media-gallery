import type { MediaItem, MediaType } from "@/types/media";

// Loaded on demand — most visits never touch zip download/import, so this
// ~100KB dependency shouldn't be in the initial bundle.
async function loadJSZip() {
  const { default: JSZip } = await import("jszip");
  return JSZip;
}

export function extensionFromSrc(src: string): string {
  const clean = src.split(/[?#]/)[0];
  const match = /\.([a-zA-Z0-9]+)$/.exec(clean);
  return match ? match[1].toLowerCase() : "bin";
}

export function slugifyFilename(title: string): string {
  return title.trim().replace(/[\\/:*?"<>|]+/g, "-") || "file";
}

/**
 * Downloads a set of media items as a single .zip, fetching each one's
 * current src (bundled asset URL, dev-server URL, or a blob: URL for
 * imported items) and packing it in by its title + original extension.
 */
export async function downloadItemsAsZip(
  items: MediaItem[],
  zipName: string,
): Promise<void> {
  if (items.length === 0) return;

  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const usedNames = new Set<string>();

  await Promise.all(
    items.map(async (item) => {
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
      zip.file(filename, blob);
    }),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyFilename(zipName)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a tick to start before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Downloads every category/folder's media as one .zip, laid out as a real
 * directory tree (Category/Folder/file or Category/file) — extract it on
 * disk and it's a normal, browsable folder structure, not just a flat pile.
 */
export interface BackupEntry {
  item: MediaItem;
  category: string;
  folder: string | null;
}

function sanitizePathSegment(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-") || "untitled";
}

export async function downloadBackupZip(
  entries: BackupEntry[],
  zipName = "media-gallery-backup",
): Promise<void> {
  if (entries.length === 0) return;

  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const usedNamesByDir = new Map<string, Set<string>>();

  await Promise.all(
    entries.map(async ({ item, category, folder }) => {
      const response = await fetch(item.src);
      const blob = await response.blob();
      const ext = extensionFromSrc(item.src);
      const dirPath = folder
        ? `${sanitizePathSegment(category)}/${sanitizePathSegment(folder)}`
        : sanitizePathSegment(category);

      const used = usedNamesByDir.get(dirPath) ?? new Set<string>();
      let filename = `${slugifyFilename(item.title)}.${ext}`;
      let n = 2;
      while (used.has(filename.toLowerCase())) {
        filename = `${slugifyFilename(item.title)}-${n}.${ext}`;
        n++;
      }
      used.add(filename.toLowerCase());
      usedNamesByDir.set(dirPath, used);

      zip.file(`${dirPath}/${filename}`, blob);
    }),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyFilename(zipName)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);
const NATIVE_VIDEO_EXTENSIONS = new Set(["mp4", "webm"]);
const PDF_EXTENSIONS = new Set(["pdf"]);

export interface ExtractedZipFile {
  filename: string;
  type: MediaType;
  blob: Blob;
}

export interface ExtractZipResult {
  files: ExtractedZipFile[];
  /** Entries that were ignored, with why (e.g. a video format the browser can't play). */
  skipped: { filename: string; reason: string }[];
}

/**
 * Reads a .zip of videos/pictures client-side (no upload anywhere). Only
 * extensions the browser can actually play/display are kept — there's no
 * server here to transcode a non-native video format the way
 * scripts/convert-videos.mjs does for files added to the repo.
 */
export async function extractMediaFromZip(
  file: File,
): Promise<ExtractZipResult> {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  const files: ExtractedZipFile[] = [];
  const skipped: ExtractZipResult["skipped"] = [];

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  for (const entry of entries) {
    const filename = entry.name.split("/").pop() ?? entry.name;
    if (filename.startsWith(".") || filename.startsWith("__MACOSX")) continue;

    const ext = extensionFromSrc(filename);
    if (IMAGE_EXTENSIONS.has(ext)) {
      const blob = await entry.async("blob");
      files.push({ filename, type: "image", blob });
    } else if (NATIVE_VIDEO_EXTENSIONS.has(ext)) {
      const blob = await entry.async("blob");
      files.push({ filename, type: "video", blob });
    } else if (PDF_EXTENSIONS.has(ext)) {
      const blob = await entry.async("blob");
      files.push({ filename, type: "pdf", blob });
    } else if (ext === "bin" || !ext) {
      // No recognizable extension — not a media file, skip silently.
      continue;
    } else {
      skipped.push({
        filename,
        reason: `.${ext} isn't playable in a browser — convert it to .mp4 first`,
      });
    }
  }

  return { files, skipped };
}

export interface BackupZipEntry {
  category: string;
  folder: string | null;
  filename: string;
  type: MediaType;
  blob: Blob;
}

export interface ExtractBackupResult {
  entries: BackupZipEntry[];
  skipped: { filename: string; reason: string }[];
}

const DEFAULT_BACKUP_CATEGORY = "Imported";

/**
 * Reads a backup .zip produced by downloadBackupZip (or any zip with
 * Category/file or Category/Folder/file paths) and recovers the category
 * and folder each entry belongs to, so a restore can rebuild the structure
 * instead of dumping everything in one place.
 */
export async function extractBackupZip(
  file: File,
): Promise<ExtractBackupResult> {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  const entries: BackupZipEntry[] = [];
  const skipped: ExtractBackupResult["skipped"] = [];

  const zipEntries = Object.values(zip.files).filter((entry) => !entry.dir);

  for (const entry of zipEntries) {
    const parts = entry.name.split("/").filter(Boolean);
    const filename = parts[parts.length - 1];
    if (
      !filename ||
      filename.startsWith(".") ||
      filename.startsWith("__MACOSX")
    )
      continue;

    const ext = extensionFromSrc(filename);
    let type: MediaType | null = null;
    if (IMAGE_EXTENSIONS.has(ext)) type = "image";
    else if (NATIVE_VIDEO_EXTENSIONS.has(ext)) type = "video";
    else if (PDF_EXTENSIONS.has(ext)) type = "pdf";
    else if (ext === "bin" || !ext) continue;
    else {
      skipped.push({
        filename,
        reason: `.${ext} isn't playable in a browser — convert it to .mp4 first`,
      });
      continue;
    }

    const category = parts.length >= 2 ? parts[0] : DEFAULT_BACKUP_CATEGORY;
    const folder = parts.length >= 3 ? parts[1] : null;
    const blob = await entry.async("blob");
    entries.push({ category, folder, filename, type, blob });
  }

  return { entries, skipped };
}

export interface ClassifiedFile {
  file: File;
  type: MediaType;
}

export interface ClassifyFilesResult {
  accepted: ClassifiedFile[];
  skipped: { filename: string; reason: string }[];
}

/**
 * Sorts raw File objects (e.g. from an OS drag-and-drop) into playable
 * images/videos/PDFs vs. ones the browser can't handle — same rules as
 * extractMediaFromZip, just without the zip layer.
 */
export function classifyDroppedFiles(files: File[]): ClassifyFilesResult {
  const accepted: ClassifiedFile[] = [];
  const skipped: ClassifyFilesResult["skipped"] = [];

  for (const file of files) {
    const ext = extensionFromSrc(file.name);
    if (IMAGE_EXTENSIONS.has(ext)) accepted.push({ file, type: "image" });
    else if (NATIVE_VIDEO_EXTENSIONS.has(ext))
      accepted.push({ file, type: "video" });
    else if (PDF_EXTENSIONS.has(ext)) accepted.push({ file, type: "pdf" });
    else if (ext !== "bin") {
      skipped.push({
        filename: file.name,
        reason: `.${ext} isn't playable in a browser — convert it to .mp4 first`,
      });
    }
  }

  return { accepted, skipped };
}
