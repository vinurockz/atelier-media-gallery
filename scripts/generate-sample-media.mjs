// One-off generator for placeholder gallery content so the app has something
// to display out of the box. Replace these files with real footage/photos —
// just drop new files into src/assets/videos/<Category>/ or
// src/assets/images/<Category>/ and they show up automatically.
//
// Run manually with: node scripts/generate-sample-media.mjs
// (Not part of the normal build — it only needs to run once.)

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VIDEOS = join(ROOT, "src", "assets", "videos");
const IMAGES = join(ROOT, "src", "assets", "images");
const ffmpeg = ffmpegStatic ?? "ffmpeg";

function run(args) {
  const result = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stderr);
    throw new Error(`ffmpeg failed: ${args.join(" ")}`);
  }
}

function makeVideo({ category, name, ext, color }) {
  const dir = join(VIDEOS, category);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}.${ext}`);
  run([
    "-f", "lavfi", "-i", `color=c=0x${color}:s=854x480:d=4,format=yuv420p`,
    "-f", "lavfi", "-i", "sine=frequency=330:duration=4",
    "-c:v", "libx264", "-preset", "medium", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k", "-shortest",
    out,
  ]);
  console.log(`  video  ${category}/${name}.${ext}`);
}

function makeImage({ category, name, color }) {
  const dir = join(IMAGES, category);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}.png`);
  run(["-f", "lavfi", "-i", `color=c=0x${color}:s=800x500`, "-frames:v", "1", out]);
  console.log(`  image  ${category}/${name}.png`);
}

const videos = [
  { category: "Nature", name: "meadow-breeze", ext: "mp4", color: "2e7d32" }, // green, native
  { category: "Nature", name: "sunrise-timelapse", ext: "mov", color: "1565c0" }, // blue, needs conversion
  { category: "City", name: "night-drive", ext: "mp4", color: "ef6c00" }, // orange, native
  { category: "Abstract", name: "neon-flow", ext: "mp4", color: "6a1b9a" }, // purple, native
];

const images = [
  { category: "Nature", name: "forest", color: "388e3c" }, // green
  { category: "Nature", name: "lake", color: "1976d2" }, // blue
  { category: "City", name: "skyline", color: "616161" }, // gray
  { category: "City", name: "sunset-street", color: "d84315" }, // red-orange
  { category: "Abstract", name: "gradient-pink", color: "d81b60" }, // pink
  { category: "Abstract", name: "sunburst", color: "f9a825" }, // yellow
];

console.log("Generating placeholder videos...");
videos.forEach(makeVideo);
console.log("Generating placeholder images...");
images.forEach(makeImage);
console.log("Done. Run `pnpm media:convert` (or `pnpm dev`) to convert the non-native video.");
