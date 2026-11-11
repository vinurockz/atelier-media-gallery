// Converts video files that browsers can't play (mkv, avi, mov, wmv, mpg, mpt, ...)
// into H.264/AAC MP4 so they show up in the gallery.
//
// Source:  src/assets/videos/<Category>/<name>.<ext>
// Output:  src/assets/videos/<Category>/_converted/<name>.mp4
//
// Files that are already mp4/webm are used as-is. Files that already have an
// .mp4 sibling with the same name are skipped to avoid duplicates.

import { existsSync, mkdirSync, readdirSync, renameSync, statSync, rmSync } from "node:fs";
import { basename, extname, join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ffmpegStatic from "ffmpeg-static";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VIDEO_DIR = join(ROOT, "src", "assets", "videos");
const CONVERTED_DIR_NAME = "_converted";

const NATIVE_EXTS = new Set([".mp4", ".webm"]);
const CONVERT_EXTS = new Set([
  ".mkv", ".avi", ".mov", ".m4v", ".wmv", ".flv", ".f4v", ".mpg", ".mpeg",
  ".mpe", ".mpv", ".mpt", ".ts", ".mts", ".m2ts", ".3gp", ".3g2", ".vob",
  ".mxf", ".asf", ".rm", ".rmvb", ".divx", ".ogv", ".ogg",
]);

const ffmpegBinary = ffmpegStatic ?? "ffmpeg";

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function convert(source, target) {
  const partial = target.replace(/\.mp4$/, ".partial.mp4");
  mkdirSync(dirname(target), { recursive: true });

  const result = spawnSync(
    ffmpegBinary,
    [
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-i", source,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      partial,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0 || !existsSync(partial)) {
    if (existsSync(partial)) rmSync(partial);
    const reason = result.error?.message ?? result.stderr?.trim() ?? "unknown error";
    console.error(`  ✗ failed: ${basename(source)} — ${reason.split("\n").slice(-2).join(" ")}`);
    return false;
  }

  renameSync(partial, target);
  return true;
}

function main() {
  const files = walk(VIDEO_DIR);
  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const name = basename(file, extname(file));
    const isConverted = file.split(/[\\/]/).includes(CONVERTED_DIR_NAME);

    if (isConverted || NATIVE_EXTS.has(ext) || !CONVERT_EXTS.has(ext)) continue;

    const siblingMp4 = join(dirname(file), `${name}.mp4`);
    if (existsSync(siblingMp4)) {
      console.log(`  - skip ${basename(file)} (${basename(siblingMp4)} already exists)`);
      skipped++;
      continue;
    }

    const target = join(dirname(file), CONVERTED_DIR_NAME, `${name}.mp4`);
    if (existsSync(target) && statSync(target).mtimeMs >= statSync(file).mtimeMs) {
      skipped++;
      continue;
    }

    console.log(`  → converting ${basename(file)}`);
    if (convert(file, target)) {
      converted++;
    } else {
      failed++;
    }
  }

  console.log(
    `Video conversion: ${converted} converted, ${skipped} up to date/skipped, ${failed} failed.`,
  );
  if (failed > 0) process.exitCode = 1;
}

main();
