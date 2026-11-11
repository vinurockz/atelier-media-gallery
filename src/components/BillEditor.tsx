import { useState, type ReactNode } from "react";
import type { Bill, BillItem, BillItemAlign } from "@/types/bill";
import type { MediaItem } from "@/types/media";
import type { BillPatch } from "@/lib/api/bills";
import { downloadBillPhoto } from "@/lib/billCanvas";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import { BillPreview } from "@/components/BillPreview";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ChevronLeftIcon,
  CloseIcon,
  DownloadIcon,
  IndentIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
} from "@/components/icons";

const MAX_INDENT = 4;

type Props = {
  bill: Bill;
  mediaItems: MediaItem[];
  onSave: (patch: BillPatch) => Promise<void>;
  onClose: () => void;
  onDelete: () => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone">{label}</span>
      {children}
    </label>
  );
}

function AlignIndentControls({
  align,
  indent,
  onAlign,
  onIndent,
}: {
  align: BillItemAlign;
  indent: number;
  onAlign: (align: BillItemAlign) => void;
  onIndent: (indent: number) => void;
}) {
  return (
    <>
      {[
        { value: "left" as const, Icon: AlignLeftIcon },
        { value: "center" as const, Icon: AlignCenterIcon },
        { value: "right" as const, Icon: AlignRightIcon },
      ].map(({ value, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onAlign(value)}
          aria-pressed={align === value}
          aria-label={`Align ${value}`}
          className={`flex size-6 items-center justify-center rounded transition ${
            align === value
              ? "bg-accent/10 text-accent"
              : "text-neutral-400 hover:bg-linen-hover"
          }`}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px bg-neutral-200" />
      <button
        type="button"
        onClick={() => onIndent(Math.max(0, indent - 1))}
        disabled={indent === 0}
        aria-label="Decrease indent"
        className="flex size-6 items-center justify-center rounded text-neutral-400 hover:bg-linen-hover disabled:opacity-30"
      >
        −
      </button>
      <span
        className="flex items-center gap-0.5 text-[10px] text-neutral-400"
        title="Indent (tab stops)"
      >
        <IndentIcon className="size-3.5" />
        {indent}
      </span>
      <button
        type="button"
        onClick={() => onIndent(Math.min(MAX_INDENT, indent + 1))}
        disabled={indent === MAX_INDENT}
        aria-label="Increase indent"
        className="flex size-6 items-center justify-center rounded text-neutral-400 hover:bg-linen-hover disabled:opacity-30"
      >
        +
      </button>
    </>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent";

/** Full Bill/Quotation editor — a form on the left, a live BillPreview on the right.
 * Field edits only update local state; nothing is sent to the server until "Save". Export
 * (PDF via window.print(), photo via canvas) always reflects the current draft, saved or not. */
export function BillEditor({
  bill,
  mediaItems,
  onSave,
  onClose,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<Bill>(bill);
  const [saving, setSaving] = useState(false);
  const [exportingPhoto, setExportingPhoto] = useState(false);
  const [picking, setPicking] = useState<"logo" | "signature" | null>(null);

  const patch = <K extends keyof Bill>(key: K, value: Bill[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const updateItem = <K extends keyof BillItem>(
    id: string,
    field: K,
    value: BillItem[K],
  ) =>
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === id ? { ...it, [field]: value } : it,
      ),
    }));

  const addItem = () =>
    setDraft((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: crypto.randomUUID(),
          text: "",
          amount: "",
          fullWidth: false,
          align: "left",
          indent: 0,
          amountAlign: "right",
          amountIndent: 0,
        },
      ],
    }));

  const removeItem = (id: string) =>
    setDraft((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== id),
    }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        docType: draft.docType,
        date: draft.date,
        billNo: draft.billNo,
        companyLogoMediaItemId: draft.companyLogoMediaItemId,
        companyName: draft.companyName,
        companyTagline: draft.companyTagline,
        companyAddress: draft.companyAddress,
        companyPhone: draft.companyPhone,
        recipientName: draft.recipientName,
        recipientAddress: draft.recipientAddress,
        salutation: draft.salutation,
        introText: draft.introText,
        items: draft.items,
        signOffText: draft.signOffText,
        signerName: draft.signerName,
        signatureMediaItemId: draft.signatureMediaItemId,
        footerText: draft.footerText,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportPhoto = async () => {
    setExportingPhoto(true);
    try {
      await downloadBillPhoto(draft, mediaItems);
    } finally {
      setExportingPhoto(false);
    }
  };

  const logo = draft.companyLogoMediaItemId
    ? mediaItems.find((m) => m.id === draft.companyLogoMediaItemId)
    : null;
  const signature = draft.signatureMediaItemId
    ? mediaItems.find((m) => m.id === draft.signatureMediaItemId)
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6 print:hidden">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to bills"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover hover:text-ink"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <h2 className="truncate text-sm font-medium text-ink">
            {draft.docType === "quotation" ? "Quotation" : "Bill"}
            {draft.recipientName ? ` — ${draft.recipientName}` : ""}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleExportPhoto}
            disabled={exportingPhoto}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover hover:text-ink disabled:opacity-50"
          >
            <DownloadIcon className="size-3.5" />
            Export photo
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover hover:text-ink"
          >
            <PrinterIcon className="size-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
        <div className="max-h-[45vh] shrink-0 overflow-y-auto border-b border-linen bg-white px-5 py-5 print:hidden sm:max-h-none sm:w-[420px] sm:border-b-0 sm:border-r">
          <div className="mb-5 flex items-center rounded-full bg-canvas p-1 ring-1 ring-linen">
            {(["bill", "quotation"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => patch("docType", t)}
                className={`flex-1 rounded-full py-1.5 text-xs font-medium capitalize transition ${
                  draft.docType === t
                    ? "bg-white text-accent shadow-sm"
                    : "text-stone"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  value={draft.date}
                  onChange={(e) => patch("date", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Bill No. (optional)">
                <input
                  value={draft.billNo}
                  onChange={(e) => patch("billNo", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone">
              Company
            </p>
            <Field label="Logo (optional — falls back to styled name/tagline)">
              {logo ? (
                <div className="relative inline-block">
                  <img
                    src={logo.src}
                    alt=""
                    className="h-14 w-auto rounded ring-1 ring-linen"
                  />
                  <button
                    type="button"
                    onClick={() => patch("companyLogoMediaItemId", null)}
                    aria-label="Remove logo"
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <CloseIcon className="size-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPicking("logo")}
                  className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-accent/50 hover:text-accent"
                >
                  Choose from library
                </button>
              )}
            </Field>
            <Field label="Company name">
              <input
                value={draft.companyName}
                onChange={(e) => patch("companyName", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Tagline">
              <input
                value={draft.companyTagline}
                onChange={(e) => patch("companyTagline", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Address">
              <textarea
                value={draft.companyAddress}
                onChange={(e) => patch("companyAddress", e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </Field>
            <Field label="Phone">
              <input
                value={draft.companyPhone}
                onChange={(e) => patch("companyPhone", e.target.value)}
                className={inputClass}
              />
            </Field>

            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone">
              Recipient
            </p>
            <Field label="Name">
              <input
                value={draft.recipientName}
                onChange={(e) => patch("recipientName", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Address">
              <textarea
                value={draft.recipientAddress}
                onChange={(e) => patch("recipientAddress", e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </Field>

            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone">
              Message
            </p>
            <Field label="Salutation">
              <input
                value={draft.salutation}
                onChange={(e) => patch("salutation", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Intro text">
              <textarea
                value={draft.introText}
                onChange={(e) => patch("introText", e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </Field>

            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone">
                Items (70% text / 30% amount, or 100% full width)
              </p>
              <button
                type="button"
                onClick={addItem}
                aria-label="Add item"
                className="flex size-5 items-center justify-center rounded-full text-accent hover:bg-linen-hover"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </div>
            {draft.items.map((item) => (
              <div
                key={item.id}
                className="space-y-1.5 rounded-md border border-neutral-200 p-2"
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateItem(item.id, "fullWidth", !item.fullWidth)
                    }
                    aria-pressed={item.fullWidth}
                    title="100% full width (no amount)"
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                      item.fullWidth
                        ? "bg-accent/10 text-accent"
                        : "text-neutral-400 hover:bg-linen-hover"
                    }`}
                  >
                    100%
                  </button>
                  <span className="mx-0.5 h-4 w-px bg-neutral-200" />
                  <AlignIndentControls
                    align={item.align}
                    indent={item.indent}
                    onAlign={(v) => updateItem(item.id, "align", v)}
                    onIndent={(v) => updateItem(item.id, "indent", v)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove item"
                    className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <CloseIcon className="size-3.5" />
                  </button>
                </div>
                {!item.fullWidth && (
                  <div className="flex items-center gap-1">
                    <span className="mr-1 text-[10px] font-semibold uppercase text-neutral-400">
                      Amount
                    </span>
                    <AlignIndentControls
                      align={item.amountAlign}
                      indent={item.amountIndent}
                      onAlign={(v) => updateItem(item.id, "amountAlign", v)}
                      onIndent={(v) => updateItem(item.id, "amountIndent", v)}
                    />
                  </div>
                )}
                <div className="flex items-start gap-1.5">
                  <textarea
                    value={item.text}
                    onChange={(e) =>
                      updateItem(item.id, "text", e.target.value)
                    }
                    placeholder="Description"
                    rows={2}
                    className={`${inputClass} min-w-0 ${item.fullWidth ? "flex-1" : "flex-[7]"} resize-none`}
                  />
                  {!item.fullWidth && (
                    <textarea
                      value={item.amount}
                      onChange={(e) =>
                        updateItem(item.id, "amount", e.target.value)
                      }
                      placeholder="Amount"
                      rows={2}
                      className={`${inputClass} min-w-0 flex-[3] resize-none`}
                    />
                  )}
                </div>
              </div>
            ))}

            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone">
              Sign-off
            </p>
            <Field label="Closing (e.g. Yours faithfully)">
              <input
                value={draft.signOffText}
                onChange={(e) => patch("signOffText", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Signed by">
              <input
                value={draft.signerName}
                onChange={(e) => patch("signerName", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Signature image (optional)">
              {signature ? (
                <div className="relative inline-block">
                  <img
                    src={signature.src}
                    alt=""
                    className="h-14 w-auto rounded ring-1 ring-linen"
                  />
                  <button
                    type="button"
                    onClick={() => patch("signatureMediaItemId", null)}
                    aria-label="Remove signature"
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <CloseIcon className="size-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPicking("signature")}
                  className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-accent/50 hover:text-accent"
                >
                  Choose from library
                </button>
              )}
            </Field>

            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone">
              Footer
            </p>
            <Field label="Products/services line">
              <textarea
                value={draft.footerText}
                onChange={(e) => patch("footerText", e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </Field>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-8 sm:py-8 print:overflow-visible print:bg-white print:p-0">
          <BillPreview bill={draft} mediaItems={mediaItems} />
        </div>
      </div>

      {picking && (
        <AttachMediaModal
          items={mediaItems}
          multiple={false}
          typeFilter="image"
          title={
            picking === "logo" ? "Choose a logo" : "Choose a signature image"
          }
          onClose={() => setPicking(null)}
          onConfirm={(ids) => {
            patch(
              picking === "logo"
                ? "companyLogoMediaItemId"
                : "signatureMediaItemId",
              ids[0] ?? null,
            );
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}
