/** "Nov 1, 2026, 3:45 PM" style — used wherever an upload/send time is shown. */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Just the time, for chat bubbles where the date is implied by context. */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { timeStyle: "short" });
}
