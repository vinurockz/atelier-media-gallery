/** Greedy word-wrap against a canvas's current font — used by meme text and speech bubbles. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface TextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draws bold, outlined meme-style text centered at (centerX, centerY), wrapped
 * to maxWidth. Shared by the image editor's draggable text layers and the
 * video editor's burned-in captions. Returns the drawn bounding box.
 */
export function drawMemeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  fontSize: number,
  color: string,
  strokeColor: string,
  maxWidth: number,
): TextBounds {
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = wrapText(ctx, text || " ", maxWidth);
  const lineHeight = fontSize * 1.15;
  const totalHeight = lines.length * lineHeight;
  let lineWidth = 0;
  lines.forEach((line) => {
    lineWidth = Math.max(lineWidth, ctx.measureText(line).width);
  });

  let y = centerY - totalHeight / 2 + lineHeight / 2;
  ctx.lineWidth = Math.max(2, fontSize * 0.08);
  ctx.lineJoin = "round";
  lines.forEach((line) => {
    ctx.strokeStyle = strokeColor;
    ctx.strokeText(line, centerX, y);
    ctx.fillStyle = color;
    ctx.fillText(line, centerX, y);
    y += lineHeight;
  });

  return {
    x: centerX - lineWidth / 2 - 8,
    y: centerY - totalHeight / 2 - 8,
    width: lineWidth + 16,
    height: totalHeight + 16,
  };
}

/** Draws a rounded speech bubble with a tail, wrapping text inside it. Returns the bounding box. */
export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  fontSize: number,
  textColor: string,
  bubbleColor: string,
  maxWidth: number,
  fontFamily = "sans-serif",
): TextBounds {
  ctx.font = `${fontSize}px ${fontFamily}`;
  const lines = wrapText(ctx, text || "...", maxWidth);
  const lineHeight = fontSize * 1.3;
  const padding = fontSize * 0.6;
  let lineWidth = 0;
  lines.forEach((line) => {
    lineWidth = Math.max(lineWidth, ctx.measureText(line).width);
  });

  const boxW = lineWidth + padding * 2;
  const boxH = lines.length * lineHeight + padding * 2;
  const left = centerX - boxW / 2;
  const top = centerY - boxH / 2;
  const radius = Math.min(16, boxH / 4, boxW / 4);
  const tailSize = radius * 1.2;

  ctx.fillStyle = bubbleColor;
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.arcTo(left + boxW, top, left + boxW, top + boxH, radius);
  ctx.arcTo(left + boxW, top + boxH, left, top + boxH, radius);
  ctx.arcTo(left, top + boxH, left, top, radius);
  ctx.arcTo(left, top, left + boxW, top, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(left + boxW * 0.22, top + boxH - 1);
  ctx.lineTo(left + boxW * 0.12, top + boxH + tailSize);
  ctx.lineTo(left + boxW * 0.38, top + boxH - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = top + padding + lineHeight / 2;
  lines.forEach((line) => {
    ctx.fillText(line, centerX, y);
    y += lineHeight;
  });

  return { x: left, y: top, width: boxW, height: boxH + tailSize };
}

/**
 * Draws a plain rounded caption box — same text-wrapping/sizing as drawSpeechBubble, but no
 * tail, for text that should read as a caption overlay (Slideshow's top/bottom text) rather
 * than a cartoon speech bubble. Returns the drawn bounding box.
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  fontSize: number,
  textColor: string,
  bgColor: string,
  maxWidth: number,
  fontFamily = "sans-serif",
): TextBounds {
  ctx.font = `${fontSize}px ${fontFamily}`;
  const lines = wrapText(ctx, text || "...", maxWidth);
  const lineHeight = fontSize * 1.3;
  const padding = fontSize * 0.5;
  let lineWidth = 0;
  lines.forEach((line) => {
    lineWidth = Math.max(lineWidth, ctx.measureText(line).width);
  });

  const boxW = lineWidth + padding * 2;
  const boxH = lines.length * lineHeight + padding * 2;
  const left = centerX - boxW / 2;
  const top = centerY - boxH / 2;
  const radius = Math.min(10, boxH / 4, boxW / 4);

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.arcTo(left + boxW, top, left + boxW, top + boxH, radius);
  ctx.arcTo(left + boxW, top + boxH, left, top + boxH, radius);
  ctx.arcTo(left, top + boxH, left, top, radius);
  ctx.arcTo(left, top, left + boxW, top, radius);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = top + padding + lineHeight / 2;
  lines.forEach((line) => {
    ctx.fillText(line, centerX, y);
    y += lineHeight;
  });

  return { x: left, y: top, width: boxW, height: boxH };
}

export type ShapeKind = "rect" | "ellipse" | "line";

/** Draws a basic shape layer (rectangle, ellipse, or line) centered at (centerX, centerY). Returns its bounding box. */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  centerX: number,
  centerY: number,
  size: number,
  fillColor: string,
  strokeColor: string,
): TextBounds {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, size * 0.06);
  const half = size / 2;

  if (kind === "rect") {
    ctx.beginPath();
    ctx.rect(centerX - half, centerY - half, size, size);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, half, half * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(centerX - half, centerY);
    ctx.lineTo(centerX + half, centerY);
    ctx.stroke();
  }
  ctx.restore();

  return {
    x: centerX - half - 6,
    y: centerY - half - 6,
    width: size + 12,
    height: size + 12,
  };
}

/** Draws a single emoji "sticker" centered at (centerX, centerY). Returns its bounding box. */
export function drawSticker(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  centerX: number,
  centerY: number,
  size: number,
): TextBounds {
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, centerX, centerY);
  const width = ctx.measureText(emoji).width || size;
  return {
    x: centerX - width / 2 - 4,
    y: centerY - size / 2 - 4,
    width: width + 8,
    height: size + 8,
  };
}

/** Draws an imported picture centered at (centerX, centerY), `width` px wide. Returns its bounding box. */
export function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  centerX: number,
  centerY: number,
  width: number,
  aspect: number,
): TextBounds {
  const height = width * aspect;
  ctx.drawImage(img, centerX - width / 2, centerY - height / 2, width, height);
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}
