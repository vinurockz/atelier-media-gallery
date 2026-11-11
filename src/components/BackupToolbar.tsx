import { useRef, useState, type ChangeEvent } from "react";
import { DownloadIcon, SpinnerIcon, UploadIcon } from "@/components/icons";

interface BackupToolbarProps {
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<{
    imported: number;
    skipped: { filename: string; reason: string }[];
  }>;
  disabled?: boolean;
}

/**
 * Whole-library backup, for when the gallery's only storage is this one PC:
 * zip every category/folder up as a real directory tree, or restore one.
 */
export function BackupToolbar({
  onExport,
  onImport,
  disabled = false,
}: BackupToolbarProps) {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setBusy("export");
    setMessage(null);
    try {
      await onExport();
    } catch (err) {
      console.error("Backup export failed", err);
      setMessage("Couldn't build the backup — see console for details.");
    } finally {
      setBusy(null);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy("import");
    setMessage(null);
    try {
      const result = await onImport(file);
      const parts = [
        `${result.imported} ${result.imported === 1 ? "file" : "files"} restored`,
      ];
      if (result.skipped.length > 0) {
        parts.push(
          `${result.skipped.length} skipped (${result.skipped[0].reason})`,
        );
      }
      setMessage(parts.join(" · "));
    } catch (err) {
      console.error("Backup import failed", err);
      setMessage("Couldn't read that backup — see console for details.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="border-t border-linen px-1 pt-3">
      <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-stone">
        Backup
      </p>
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || busy !== null}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink transition hover:bg-linen-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy === "export" ? (
          <SpinnerIcon className="size-4 animate-spin text-stone" />
        ) : (
          <DownloadIcon className="size-4 text-stone" />
        )}
        Export everything
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy !== null}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink transition hover:bg-linen-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy === "import" ? (
          <SpinnerIcon className="size-4 animate-spin text-stone" />
        ) : (
          <UploadIcon className="size-4 text-stone" />
        )}
        Restore from backup
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileChange}
        className="hidden"
      />
      {message && <p className="mt-1 px-2 text-xs text-stone">{message}</p>}
    </div>
  );
}
