import PDFDocument from "pdfkit";

const AVATAR_RADIUS = 14;
const AVATAR_GAP = 10;
const BUBBLE_PADDING = 10;
const NAME_HEIGHT = 14;
const TIME_GAP = 4;
const TIME_HEIGHT = 11;
const BLOCK_GAP = 14;

// Mirrors the Tailwind theme colors ChatView renders with (src/styles/index.css).
const SELF_BUBBLE = "#1a73e8"; // --color-drive-blue
const SELF_TEXT = "#ffffff";
const SELF_TIME = "#cfe0fb"; // white/70-ish on the blue bubble
const OTHER_BUBBLE = "#f8f9fa"; // --color-drive-surface
const OTHER_TEXT = "#202124"; // --color-drive-text
const OTHER_TIME = "#9ca3af"; // neutral-400

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { timeStyle: "short" });
}

/**
 * Builds a PDF transcript that mirrors ChatView exactly: colored avatar,
 * rounded bubble, and — when `asUserId` is given — the same left/right,
 * blue-vs-gray split ChatView uses for "is this message mine". Without
 * `asUserId` everything renders on the left, since there's no "me" to pick.
 * Attachments aren't embedded, just noted as a count — the server can now
 * reach their bytes too (see index.mjs's /api/media routes and db.mjs's
 * `media` collection), so embedding them via doc.image() is a reasonable
 * follow-up, just not done here yet.
 */
export function buildChatPdf({ content, users, messages, asUserId }) {
  const doc = new PDFDocument({ margin: 50 });
  const usersById = new Map(users.map((u) => [u.id, u]));
  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const contentWidth = pageRight - pageLeft;
  const sideReserve = AVATAR_RADIUS * 2 + AVATAR_GAP;
  const bubbleWidth = Math.min(320, contentWidth - sideReserve);
  const textWidth = bubbleWidth - BUBBLE_PADDING * 2;

  doc.fontSize(18).fillColor("#111").font("Helvetica-Bold").text(content.name);
  doc.fontSize(9).fillColor("#666").font("Helvetica").text(`Exported ${new Date().toLocaleString()}`);
  doc.moveDown(1.5);

  if (messages.length === 0) {
    doc.fontSize(11).fillColor("#000").text("No messages yet.");
    doc.end();
    return doc;
  }

  for (const message of messages) {
    const sender = usersById.get(message.userId);
    const isSelf = asUserId != null && message.userId === asUserId;
    const name = sender?.name ?? "Unknown";
    const color = sender?.color ?? "#9ca3af";
    const timestamp = formatTime(message.createdAt);
    const attachmentNote = message.attachmentIds.length > 0 ? `[${message.attachmentIds.length} attachment(s)]` : "";

    doc.font("Helvetica").fontSize(11);
    const textHeight = message.text ? doc.heightOfString(message.text, { width: textWidth }) : 0;
    doc.fontSize(9);
    const noteHeight = attachmentNote ? doc.heightOfString(attachmentNote, { width: textWidth }) + TIME_GAP : 0;
    const nameHeight = isSelf ? 0 : NAME_HEIGHT;
    const bubbleHeight =
      nameHeight + textHeight + (textHeight > 0 ? TIME_GAP : 0) + TIME_HEIGHT + noteHeight + BUBBLE_PADDING * 2;
    const blockHeight = Math.max(bubbleHeight, AVATAR_RADIUS * 2);

    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + blockHeight > bottom) doc.addPage();
    const startY = doc.y;

    const bubbleX = isSelf ? pageRight - bubbleWidth - sideReserve : pageLeft + sideReserve;
    const avatarCx = isSelf ? pageRight - AVATAR_RADIUS : pageLeft + AVATAR_RADIUS;
    const avatarX = isSelf ? pageRight - AVATAR_RADIUS * 2 : pageLeft;

    // Avatar — colored circle with the sender's initial.
    doc.save();
    doc.circle(avatarCx, startY + AVATAR_RADIUS, AVATAR_RADIUS).fill(color);
    doc
      .fillColor("#fff")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(name.slice(0, 1).toUpperCase(), avatarX, startY + AVATAR_RADIUS - 6, {
        width: AVATAR_RADIUS * 2,
        align: "center",
      });
    doc.restore();

    // Bubble background.
    doc.roundedRect(bubbleX, startY, bubbleWidth, bubbleHeight, 14).fill(isSelf ? SELF_BUBBLE : OTHER_BUBBLE);

    let innerY = startY + BUBBLE_PADDING;
    const textX = bubbleX + BUBBLE_PADDING;

    // Sender name — only shown for other people's messages, same as ChatView.
    if (!isSelf) {
      doc.fillColor(color).font("Helvetica-Bold").fontSize(10).text(name, textX, innerY, { width: textWidth });
      innerY += nameHeight;
    }

    if (message.text) {
      doc
        .fillColor(isSelf ? SELF_TEXT : OTHER_TEXT)
        .font("Helvetica")
        .fontSize(11)
        .text(message.text, textX, innerY, { width: textWidth });
      innerY += textHeight + TIME_GAP;
    }

    if (attachmentNote) {
      doc
        .fillColor(isSelf ? SELF_TIME : OTHER_TIME)
        .font("Helvetica-Oblique")
        .fontSize(9)
        .text(attachmentNote, textX, innerY, { width: textWidth });
      innerY += noteHeight;
    }

    doc
      .fillColor(isSelf ? SELF_TIME : OTHER_TIME)
      .font("Helvetica")
      .fontSize(8)
      .text(timestamp, textX, innerY, { width: textWidth });

    doc.x = pageLeft;
    doc.y = startY + blockHeight + BLOCK_GAP;
  }

  doc.end();
  return doc;
}
