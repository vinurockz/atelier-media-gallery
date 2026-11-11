import type { MediaItem } from "@/types/media";

/** Downloads a single item directly, without zipping it. */
export function downloadMediaItem(item: MediaItem): void {
  const a = document.createElement("a");
  a.href = item.src;
  a.download = item.title;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
