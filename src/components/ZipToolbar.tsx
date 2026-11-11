import { useRef, useState } from "react";
import type { MediaItem } from "@/types/media";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { downloadItemsAsZip } from "@/lib/zip";
import { DownloadIcon, SpinnerIcon, UploadIcon } from "@/components/icons";

interface ZipToolbarProps {
  items: MediaItem[];
  zipName: string;
  onImport: (file: File) => Promise<ImportZipOutcome>;
  importLabel: string;
}

/** "Download as ZIP" + "Import ZIP" controls, shared by category and folder views. */
export function ZipToolbar({
  items,
  zipName,
  onImport,
  importLabel,
}: ZipToolbarProps) {
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setMessage(null);
    try {
      await downloadItemsAsZip(items, zipName);
    } catch (err) {
      console.error("Zip download failed", err);
      setMessage("Couldn't build the zip — see console for details.");
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setMessage(null);
    try {
      const result = await onImport(file);
      const parts = [
        `${result.imported} ${result.imported === 1 ? "file" : "files"} imported`,
      ];
      if (result.skipped.length > 0) {
        parts.push(
          `${result.skipped.length} skipped (${result.skipped[0].reason})`,
        );
      }
      setMessage(parts.join(" · "));
    } catch (err) {
      console.error("Zip import failed", err);
      setMessage("Couldn't read that zip — see console for details.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={items.length === 0 || downloading}
        className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {downloading ? (
          <SpinnerIcon className="size-3.5 animate-spin" />
        ) : (
          <DownloadIcon className="size-3.5" />
        )}
        Download ZIP
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {importing ? (
          <SpinnerIcon className="size-3.5 animate-spin" />
        ) : (
          <UploadIcon className="size-3.5" />
        )}
        {importLabel}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileChange}
        className="hidden"
      />

      {message && <span className="text-xs text-neutral-500">{message}</span>}
    </div>
  );
}
