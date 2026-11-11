const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Formats a byte count as the smallest unit that keeps it readable (e.g. "1.4 MB", "822 KB"). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const precision = exponent === 0 ? 0 : value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(precision)} ${UNITS[exponent]}`;
}
