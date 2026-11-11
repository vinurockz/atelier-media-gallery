import type { Bill, BillItemAlign } from "@/types/bill";
import type { MediaItem } from "@/types/media";

type Props = {
  bill: Bill;
  mediaItems: MediaItem[];
};

const ALIGN_CLASS: Record<BillItemAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
const INDENT_PX = 24;

/**
 * The actual printable Bill/Quotation layout — rendered both as the live on-screen
 * preview and, via the `print-area` class (see src/styles/index.css's `@media print`
 * block), as the only thing visible when "Export PDF" calls `window.print()`.
 */
export function BillPreview({ bill, mediaItems }: Props) {
  const logo = bill.companyLogoMediaItemId
    ? mediaItems.find((m) => m.id === bill.companyLogoMediaItemId)
    : null;
  const signature = bill.signatureMediaItemId
    ? mediaItems.find((m) => m.id === bill.signatureMediaItemId)
    : null;

  const itemLines = bill.items.filter((it) => it.text || it.amount);
  // Only amounts that actually show next to their row (not full-width ones) count toward
  // the total — a full-width item's leftover amount text, if any, is never displayed.
  const pricedLines = itemLines.filter(
    (it) => !it.fullWidth && it.amount.trim(),
  );
  const amountCount = pricedLines.length;
  const total = pricedLines.reduce((sum, it) => {
    const n = Number(it.amount.replace(/[^0-9.-]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const recipientLines = [
    bill.recipientName,
    ...bill.recipientAddress.split("\n"),
  ].filter(Boolean);

  return (
    <div className="print-area mx-auto w-[800px] bg-white p-10 text-neutral-900 shadow-sm ring-1 ring-black/10 print:w-full print:p-12 print:shadow-none print:ring-0">
      <div className="flex items-start justify-between gap-6 border-b-2 border-neutral-800 pb-3">
        <div>
          {logo ? (
            <img
              src={logo.src}
              alt={bill.companyName}
              className="max-h-16 max-w-[220px] object-contain"
            />
          ) : (
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-red-700">
                {bill.companyName || "Company Name"}
              </p>
              <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
                {bill.companyTagline}
              </p>
            </div>
          )}
        </div>
        <div className="max-w-[300px] shrink-0 break-words text-right text-xs leading-relaxed text-neutral-600">
          {bill.companyAddress.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {bill.companyPhone && (
            <p className="mt-1 font-medium">Ph: {bill.companyPhone}</p>
          )}
        </div>
      </div>

      <p className="mt-2 text-right text-sm text-neutral-700">{bill.date}</p>

      <h1 className="mt-4 text-center text-xl font-bold uppercase tracking-wide underline underline-offset-4">
        {bill.docType === "quotation" ? "Quotation" : "Bill"}
      </h1>
      {bill.billNo && (
        <p className="text-center text-xs text-neutral-500">
          No. {bill.billNo}
        </p>
      )}

      {/* Recipient block is fully optional — omitted from the layout entirely (no
          placeholder text) when neither a name nor an address has been filled in, so an
          unused bill doesn't export with a dangling "To," and empty space. */}
      {recipientLines.length > 0 && (
        <div className="mt-6 text-sm">
          <p className="font-medium">To,</p>
          {recipientLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      <p className="mt-5 text-sm">{bill.salutation}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
        {bill.introText}
      </p>

      <div className="mt-6 space-y-2">
        {itemLines.map((item) => {
          // Explicit "100% full width" or simply no amount both read as a plain
          // description line; otherwise it's the 70/30 split.
          const isFullWidth = item.fullWidth || !item.amount.trim();
          const style =
            item.indent > 0
              ? { paddingLeft: item.indent * INDENT_PX }
              : undefined;
          return isFullWidth ? (
            <p
              key={item.id}
              style={style}
              className={`whitespace-pre-wrap break-words text-sm font-semibold ${ALIGN_CLASS[item.align]}`}
            >
              {item.text}
            </p>
          ) : (
            <div key={item.id} className="flex items-start gap-4 text-sm">
              <p
                style={style}
                className={`min-w-0 w-[70%] whitespace-pre-wrap break-words font-semibold ${ALIGN_CLASS[item.align]}`}
              >
                {item.text}
              </p>
              <p
                style={
                  item.amountIndent > 0
                    ? { paddingLeft: item.amountIndent * INDENT_PX }
                    : undefined
                }
                className={`min-w-0 w-[30%] whitespace-pre-wrap break-words font-medium ${ALIGN_CLASS[item.amountAlign]}`}
              >
                {item.amount}
              </p>
            </div>
          );
        })}
        {amountCount > 1 && (
          <div className="flex items-start gap-4 border-t border-neutral-300 pt-1.5 text-sm">
            <p className="w-[70%] text-right font-semibold">Total</p>
            <p className="w-[30%] text-right font-semibold underline underline-offset-2">
              {total.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      <div className="mt-14 flex justify-end">
        <div className="text-right text-sm">
          <p>{bill.signOffText},</p>
          <p className="mt-1 font-medium">{bill.signerName || " "}</p>
          {signature && (
            <img
              src={signature.src}
              alt="Signature"
              className="ml-auto mt-2 h-14 object-contain"
            />
          )}
        </div>
      </div>

      {bill.footerText && (
        <p className="mt-10 border-t border-neutral-800 pt-2 text-center text-xs text-neutral-600">
          {bill.footerText}
        </p>
      )}
    </div>
  );
}
