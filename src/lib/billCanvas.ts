import type { Bill, BillItem } from "@/types/bill";
import type { MediaItem } from "@/types/media";

const WIDTH = 1000;
const MARGIN = 60;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const INDENT_PX = 24;

/** Explicit "100% full width" or simply no amount both read as a plain description line. */
function isFullWidthItem(item: BillItem): boolean {
  return item.fullWidth || !item.amount.trim();
}

/** Draws pre-wrapped lines inside a [boxX, boxX+boxW] box per `align`, returning the y
 * just below the last line. */
function drawAligned(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  boxX: number,
  boxW: number,
  align: BillItem["align"],
  y: number,
  lineHeight: number,
): number {
  const x =
    align === "left"
      ? boxX
      : align === "center"
        ? boxX + boxW / 2
        : boxX + boxW;
  ctx.textAlign = align;
  const endY = drawLines(ctx, lines, x, y, lineHeight);
  ctx.textAlign = "left";
  return endY;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}

/** Word-wraps `text` (respecting existing newlines) to `maxWidth` under the context's
 * current font — the single source of truth both the height pass and the draw pass use,
 * so they can never disagree on how many lines something takes. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const rawWord of paragraph.split(" ")) {
      // A single word wider than the box (no spaces) is split by character so it never overflows.
      const words: string[] = [];
      let chunk = "";
      for (const ch of rawWord) {
        if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
          words.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      words.push(chunk);
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
): number {
  let cursorY = y;
  for (const line of lines) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

/**
 * Draws a Bill/Quotation onto a canvas for "export as photo" — a from-scratch Canvas2D
 * layout (not a DOM screenshot), same "canvas + native browser APIs over a new dependency"
 * approach the Editor module uses, so no html2canvas/jsPDF dependency is needed.
 */
export async function renderBillToCanvas(
  bill: Bill,
  mediaItems: MediaItem[],
): Promise<HTMLCanvasElement> {
  const logo = bill.companyLogoMediaItemId
    ? mediaItems.find((m) => m.id === bill.companyLogoMediaItemId)
    : null;
  const signature = bill.signatureMediaItemId
    ? mediaItems.find((m) => m.id === bill.signatureMediaItemId)
    : null;
  const [logoImg, signatureImg] = await Promise.all([
    logo ? loadImage(logo.src).catch(() => null) : Promise.resolve(null),
    signature
      ? loadImage(signature.src).catch(() => null)
      : Promise.resolve(null),
  ]);

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = "13px Arial";
  const addressLines = wrapLines(
    measure,
    bill.companyAddress,
    CONTENT_WIDTH * 0.45,
  );
  measure.font = "14px Arial";
  const introLines = wrapLines(measure, bill.introText, CONTENT_WIDTH);
  const recipientLines = [
    bill.recipientName,
    ...bill.recipientAddress.split("\n"),
  ].filter(Boolean);
  const itemLines = bill.items.filter((it) => it.text || it.amount);
  // Only amounts that actually show next to their row (not full-width ones) count toward
  // the total — a full-width item's leftover amount text, if any, is never displayed.
  const pricedLines = itemLines.filter(
    (it) => !it.fullWidth && it.amount.trim(),
  );
  const amountCount = pricedLines.length;
  measure.font = "bold 14px Arial";
  const itemBoxWidth = (it: BillItem) =>
    Math.max(
      60,
      (isFullWidthItem(it) ? CONTENT_WIDTH : CONTENT_WIDTH * 0.65) -
        it.indent * INDENT_PX,
    );
  const itemWrapped = itemLines.map((it) =>
    wrapLines(measure, it.text, itemBoxWidth(it)),
  );
  const amountBoxX = (it: BillItem) =>
    MARGIN + CONTENT_WIDTH * 0.68 + it.amountIndent * INDENT_PX;
  const amountBoxWidth = (it: BillItem) =>
    Math.max(40, WIDTH - MARGIN - amountBoxX(it));
  const amountWrapped = itemLines.map((it) =>
    isFullWidthItem(it)
      ? []
      : wrapLines(measure, it.amount, amountBoxWidth(it)),
  );
  const rowLineCounts = itemWrapped.map((lines, i) =>
    Math.max(lines.length, amountWrapped[i].length),
  );
  const itemLineCount = rowLineCounts.reduce((sum, n) => sum + n, 0);

  // Generous, additive section heights — slight extra whitespace at the bottom is a far
  // safer failure mode here than clipping content, so this rounds up rather than trying
  // to match the draw pass pixel-for-pixel.
  const height =
    MARGIN + // top margin
    Math.max(90, addressLines.length * 17 + 30) + // header row (logo/name vs address block)
    40 + // divider + date
    50 + // title
    (recipientLines.length > 0 ? 20 + recipientLines.length * 20 : 0) + // "To," block, optional
    35 + // salutation
    introLines.length * 20 +
    20 +
    itemLineCount * 24 +
    (amountCount > 1 ? 25 : 0) +
    160 + // sign-off block
    (bill.footerText ? 70 : 20) +
    MARGIN;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "alphabetic";

  let cursorY = MARGIN;

  // Header: logo/company name left, address/phone right.
  if (logoImg) {
    const h = 64;
    const w = (logoImg.width / logoImg.height) * h;
    ctx.drawImage(logoImg, MARGIN, cursorY, w, h);
  } else {
    ctx.fillStyle = "#b91c1c";
    ctx.font = "bold 30px Arial";
    ctx.fillText(bill.companyName || "Company Name", MARGIN, cursorY + 28);
    ctx.fillStyle = "#0f766e";
    ctx.font = "bold 13px Arial";
    ctx.fillText(bill.companyTagline.toUpperCase(), MARGIN, cursorY + 50);
  }

  ctx.fillStyle = "#525252";
  ctx.font = "13px Arial";
  ctx.textAlign = "right";
  let addrY = drawLines(ctx, addressLines, WIDTH - MARGIN, cursorY + 12, 17);
  if (bill.companyPhone) {
    ctx.fillText(`Ph: ${bill.companyPhone}`, WIDTH - MARGIN, addrY);
    addrY += 17;
  }
  ctx.textAlign = "left";

  cursorY += Math.max(85, addressLines.length * 17 + 25);
  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, cursorY);
  ctx.lineTo(WIDTH - MARGIN, cursorY);
  ctx.stroke();

  cursorY += 25;
  ctx.fillStyle = "#404040";
  ctx.font = "14px Arial";
  ctx.textAlign = "right";
  ctx.fillText(bill.date, WIDTH - MARGIN, cursorY);
  ctx.textAlign = "left";

  cursorY += 35;
  ctx.fillStyle = "#171717";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "center";
  const title = bill.docType === "quotation" ? "QUOTATION" : "BILL";
  ctx.fillText(title, WIDTH / 2, cursorY);
  const titleWidth = ctx.measureText(title).width;
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.moveTo(WIDTH / 2 - titleWidth / 2, cursorY + 5);
  ctx.lineTo(WIDTH / 2 + titleWidth / 2, cursorY + 5);
  ctx.stroke();
  ctx.textAlign = "left";

  cursorY += 45;
  if (recipientLines.length > 0) {
    ctx.font = "bold 14px Arial";
    ctx.fillText("To,", MARGIN, cursorY);
    ctx.font = "14px Arial";
    for (const line of recipientLines) {
      cursorY += 20;
      ctx.fillText(line, MARGIN, cursorY);
    }
    cursorY += 15;
  }

  cursorY += 20;
  ctx.fillText(bill.salutation, MARGIN, cursorY);

  cursorY += 25;
  ctx.font = "14px Arial";
  cursorY = drawLines(ctx, introLines, MARGIN, cursorY, 20);

  cursorY += 15;
  let total = 0;
  for (const it of pricedLines) {
    const n = Number(it.amount.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) total += n;
  }
  ctx.font = "bold 14px Arial";
  itemLines.forEach((item, i) => {
    const lines = itemWrapped[i];
    const boxX = MARGIN + item.indent * INDENT_PX;
    const boxW = itemBoxWidth(item);
    // The amount column wraps independently of the description; the row takes the taller of the two.
    drawAligned(ctx, lines, boxX, boxW, item.align, cursorY, 24);
    const amountLines = amountWrapped[i];
    if (amountLines.length > 0) {
      drawAligned(
        ctx,
        amountLines,
        amountBoxX(item),
        amountBoxWidth(item),
        item.amountAlign,
        cursorY,
        24,
      );
    }
    cursorY += rowLineCounts[i] * 24;
  });
  if (amountCount > 1) {
    cursorY += 5;
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.moveTo(WIDTH - MARGIN - 120, cursorY - 14);
    ctx.lineTo(WIDTH - MARGIN, cursorY - 14);
    ctx.stroke();
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`Total  ${total.toLocaleString()}`, WIDTH - MARGIN, cursorY);
    ctx.textAlign = "left";
    cursorY += 20;
  }

  cursorY += 60;
  ctx.font = "14px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`${bill.signOffText},`, WIDTH - MARGIN, cursorY);
  cursorY += 22;
  ctx.font = "bold 14px Arial";
  ctx.fillText(bill.signerName, WIDTH - MARGIN, cursorY);
  if (signatureImg) {
    const h = 50;
    const w = (signatureImg.width / signatureImg.height) * h;
    ctx.drawImage(signatureImg, WIDTH - MARGIN - w, cursorY + 10, w, h);
  }
  ctx.textAlign = "left";

  if (bill.footerText) {
    cursorY += 50;
    ctx.strokeStyle = "#262626";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN, cursorY);
    ctx.lineTo(WIDTH - MARGIN, cursorY);
    ctx.stroke();
    cursorY += 22;
    ctx.fillStyle = "#525252";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(bill.footerText, WIDTH / 2, cursorY);
    ctx.textAlign = "left";
  }

  return canvas;
}

export async function downloadBillPhoto(
  bill: Bill,
  mediaItems: MediaItem[],
): Promise<void> {
  const canvas = await renderBillToCanvas(bill, mediaItems);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bill.docType}-${(bill.companyName || "bill").toLowerCase().replace(/\s+/g, "-")}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
