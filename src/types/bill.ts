export type BillDocType = "bill" | "quotation";

export type BillItemAlign = "left" | "center" | "right";

/** One line of the body — normally a 70/30 description/amount split, or a 100% full-width
 * line when `fullWidth` is set (also implied by leaving `amount` blank). */
export interface BillItem {
  id: string;
  text: string;
  amount: string;
  fullWidth: boolean;
  align: BillItemAlign;
  /** Indent "steps" (tab stops) before the text — 0 means flush left. */
  indent: number;
  /** Alignment of the amount inside its 30% column. */
  amountAlign: BillItemAlign;
  /** Indent steps (tab stops) inside the amount column. */
  amountIndent: number;
}

export interface Bill {
  id: string;
  docType: BillDocType;
  date: string;
  billNo: string;

  /** Optional logo — a MediaItem id, same convention as every other image reference in
   * this app. Falls back to styled company name/tagline text when unset. */
  companyLogoMediaItemId: string | null;
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  companyPhone: string;

  recipientName: string;
  recipientAddress: string;
  salutation: string;
  introText: string;

  items: BillItem[];

  signOffText: string;
  signerName: string;
  signatureMediaItemId: string | null;

  footerText: string;

  createdAt: number;
  updatedAt: number;
}
