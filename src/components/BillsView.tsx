import { useState } from "react";
import type { Bill } from "@/types/bill";
import type { MediaItem } from "@/types/media";
import type { BillPatch } from "@/lib/api/bills";
import { BillEditor } from "@/components/BillEditor";
import { PlusIcon, ReceiptIcon, TrashIcon } from "@/components/icons";

type Props = {
  bills: Bill[];
  mediaItems: MediaItem[];
  onCreate: (docType: Bill["docType"]) => Promise<string>;
  onSave: (id: string, patch: BillPatch) => Promise<void>;
  onDelete: (id: string) => void;
};

/** Grid of saved bills/quotations — mirrors the Files/Chat module tile grids. Clicking one
 * opens BillEditor; "New bill"/"New quotation" create and jump straight into the editor. */
export function BillsView({
  bills,
  mediaItems,
  onCreate,
  onSave,
  onDelete,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openBill = openId ? (bills.find((b) => b.id === openId) ?? null) : null;

  const handleCreate = async (docType: Bill["docType"]) => {
    const id = await onCreate(docType);
    setOpenId(id);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}"? This can't be undone.`)) {
      if (openId === id) setOpenId(null);
      onDelete(id);
    }
  };

  if (openBill) {
    return (
      <BillEditor
        bill={openBill}
        mediaItems={mediaItems}
        onSave={(patch) => onSave(openBill.id, patch)}
        onClose={() => setOpenId(null)}
        onDelete={() =>
          handleDelete(openBill.id, openBill.companyName || "this bill")
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <ReceiptIcon className="size-4 text-stone" />
          <h1 className="text-base font-medium text-ink">
            Bills &amp; Quotations
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleCreate("quotation")}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover hover:text-ink"
          >
            <PlusIcon className="size-3.5" />
            New quotation
          </button>
          <button
            type="button"
            onClick={() => handleCreate("bill")}
            className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
          >
            <PlusIcon className="size-3.5" />
            New bill
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        {bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ReceiptIcon className="size-10 text-neutral-300" />
            <p className="mt-3 text-sm text-stone">
              No bills or quotations yet. Create one above to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {bills.map((bill) => (
              <div key={bill.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setOpenId(bill.id)}
                  className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-lg bg-white px-3 text-center ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <ReceiptIcon className="size-5" />
                  </span>
                  <span className="w-full truncate text-xs font-semibold text-ink">
                    {bill.recipientName ||
                      (bill.docType === "quotation"
                        ? "Untitled quotation"
                        : "Untitled bill")}
                  </span>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone">
                    {bill.docType}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {bill.date}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDelete(bill.id, bill.recipientName || "this bill")
                  }
                  aria-label="Delete bill"
                  className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-white text-red-500 opacity-0 shadow ring-1 ring-black/5 transition hover:bg-red-50 group-hover:opacity-100"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
