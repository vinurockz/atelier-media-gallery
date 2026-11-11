import { useRef, useState, type ChangeEvent } from "react";
import type { Customer } from "@/types/customer";
import { customerPhotoUrl } from "@/lib/api/customers";
import { CloseIcon, SpinnerIcon, UploadIcon } from "@/components/icons";

type Props = {
  /** null when creating a brand-new customer. */
  customer: Customer | null;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<Customer>;
  onSetPhoto: (id: string, file: File) => Promise<void>;
};

/** Create or edit one customer — name, description, and a photo. Photo upload only works
 * once the customer actually has an id, so for a brand-new one this saves the name/
 * description first (getting an id back) before uploading. */
export function CustomerEditorModal({
  customer,
  onClose,
  onSave,
  onSetPhoto,
}: Props) {
  const [name, setName] = useState(customer?.name ?? "");
  const [description, setDescription] = useState(customer?.description ?? "");
  const [savedCustomer, setSavedCustomer] = useState<Customer | null>(customer);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await onSave(trimmed, description.trim());
      setSavedCustomer(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // A brand-new customer needs to be saved first so there's an id to attach a photo to.
    let target = savedCustomer;
    if (!target) {
      const trimmed = name.trim();
      if (!trimmed) {
        setError("Name is required before adding a photo");
        return;
      }
      setSaving(true);
      try {
        target = await onSave(trimmed, description.trim());
        setSavedCustomer(target);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setUploadingPhoto(true);
    setError(null);
    try {
      await onSetPhoto(target.id, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-linen bg-surface shadow-lifted">
        <div className="flex items-center justify-between border-b border-linen px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            {customer ? "Edit customer" : "New customer"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-full text-stone transition-colors hover:bg-linen-hover"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-linen">
              {savedCustomer?.hasPhoto ? (
                <img
                  src={customerPhotoUrl(savedCustomer.id)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-stone">
                  {(name || "?").trim().slice(0, 1).toUpperCase()}
                </span>
              )}
              {uploadingPhoto && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/40">
                  <SpinnerIcon className="size-4 animate-spin text-white" />
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto || saving}
              className="flex items-center gap-1.5 rounded-full border border-linen px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-linen-hover disabled:opacity-50"
            >
              <UploadIcon className="size-3.5" />
              {savedCustomer?.hasPhoto ? "Change photo" : "Add photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              className="hidden"
            />
          </div>

          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer name"
            aria-label="Customer name"
            className="w-full rounded-md border border-linen px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            aria-label="Description"
            className="w-full resize-none rounded-md border border-linen px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-linen px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-stone transition-colors hover:bg-linen-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || uploadingPhoto}
            onClick={() => void save()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
