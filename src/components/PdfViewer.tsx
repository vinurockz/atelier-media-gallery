import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { MediaItem } from "@/types/media";
import type { HighlightRect } from "@/types/pdf";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { downloadHighlightedPdf, loadPdfjs } from "@/lib/pdf";
import { usePdfHighlights } from "@/hooks/usePdfHighlights";
import {
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  HighlighterIcon,
  SpinnerIcon,
} from "@/components/icons";

interface PdfViewerProps {
  item: MediaItem;
  onClose: () => void;
  /** Omitted entirely where snapshotting to the library isn't wired up — hides the tool. */
  onSaveSnapshot?: (file: File) => Promise<MediaItem | null>;
}

type Tool = "select" | "snapshot";

interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PendingSelection {
  rects: HighlightRect[];
  text: string;
  /** Container-relative CSS px — positions the floating color picker. */
  anchorX: number;
  anchorY: number;
}

const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#fbcfe8", "#bfdbfe"];
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

/**
 * Full-screen PDF reader: renders pages via pdf.js onto a canvas, with a
 * transparent, selectable text layer on top (also pdf.js) so dragging over
 * real words — not a freehand marker — produces a highlight. A second tool
 * drags a capture rectangle over the rendered page and saves that region as
 * a new image in the file library, the same non-destructive "save a new
 * file, touch nothing else" pattern the Editor module's lasso tool uses.
 */
export function PdfViewer({ item, onClose, onSaveSnapshot }: PdfViewerProps) {
  const { highlights, addHighlight, removeHighlight } = usePdfHighlights(
    item.id,
  );

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.25);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [snapshotDraft, setSnapshotDraft] = useState<PixelRect | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const snapshotStartRef = useRef<{ x: number; y: number } | null>(null);

  // --- Load the document ----------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setPdfDoc(null);
    const pdfjsLibPromise = loadPdfjs();
    let loadingTask: ReturnType<
      Awaited<typeof pdfjsLibPromise>["getDocument"]
    > | null = null;
    (async () => {
      try {
        const pdfjsLib = await pdfjsLibPromise;
        const res = await fetch(item.src);
        const data = await res.arrayBuffer();
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({ data });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error("Couldn't open PDF", err);
        if (!cancelled) setLoadError("Couldn't open this PDF.");
      }
    })();
    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [item.src]);

  // --- Render the current page -----------------------------------------------

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;

    (async () => {
      const page = await pdfDoc.getPage(currentPage);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: zoom });

      const canvas = canvasRef.current;
      const textLayerEl = textLayerRef.current;
      if (!canvas || !textLayerEl) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      textLayerEl.style.width = `${viewport.width}px`;
      textLayerEl.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      renderTaskRef.current?.cancel();
      const task = page.render({ canvas, canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        if (
          !(err instanceof Error) ||
          err.name !== "RenderingCancelledException"
        ) {
          console.error("Page render failed", err);
        }
      }
      if (cancelled) return;

      textLayerEl.innerHTML = "";
      const pdfjsLib = await loadPdfjs();
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textLayerEl,
        viewport,
      });
      try {
        await textLayer.render();
      } catch (err) {
        console.error("Text layer render failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  // Floating UI tied to one page/tool doesn't carry over to the next.
  useEffect(() => {
    setPendingSelection(null);
    setSnapshotDraft(null);
    window.getSelection()?.removeAllRanges();
  }, [currentPage, tool]);

  // --- Navigation / zoom / keyboard -------------------------------------------

  const goToPage = (page: number) => {
    if (numPages === 0) return;
    setCurrentPage(Math.min(numPages, Math.max(1, page)));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      )
        return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goToPage(currentPage + 1);
      else if (e.key === "ArrowLeft") goToPage(currentPage - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, numPages, onClose]);

  // --- Highlighting ------------------------------------------------------------

  const handleTextLayerMouseUp = () => {
    if (tool !== "select") return;
    const textLayerEl = textLayerRef.current;
    const selection = window.getSelection();
    if (
      !textLayerEl ||
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0
    ) {
      setPendingSelection(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      setPendingSelection(null);
      return;
    }

    const containerRect = textLayerEl.getBoundingClientRect();
    const rects: HighlightRect[] = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      if (!textLayerEl.contains(range.commonAncestorContainer)) continue;
      Array.from(range.getClientRects()).forEach((r) => {
        if (r.width === 0 || r.height === 0) return;
        rects.push({
          x: (r.left - containerRect.left) / containerRect.width,
          y: (r.top - containerRect.top) / containerRect.height,
          w: r.width / containerRect.width,
          h: r.height / containerRect.height,
        });
      });
    }
    if (rects.length === 0) {
      setPendingSelection(null);
      return;
    }
    const last = rects[rects.length - 1];
    setPendingSelection({
      rects,
      text,
      anchorX: (last.x + last.w) * containerRect.width,
      anchorY: last.y * containerRect.height,
    });
  };

  const commitHighlight = async (color: string) => {
    if (!pendingSelection) return;
    await addHighlight({
      mediaItemId: item.id,
      page: currentPage,
      rects: pendingSelection.rects,
      color,
      text: pendingSelection.text,
    });
    window.getSelection()?.removeAllRanges();
    setPendingSelection(null);
  };

  // --- Snapshot ------------------------------------------------------------------

  const toCanvasPoint = (e: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const onStackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== "snapshot") return;
    const p = toCanvasPoint(e);
    snapshotStartRef.current = p;
    setSnapshotDraft({ x: p.x, y: p.y, w: 0, h: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onStackPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== "snapshot" || !snapshotStartRef.current) return;
    const p = toCanvasPoint(e);
    const start = snapshotStartRef.current;
    setSnapshotDraft({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    });
  };

  const onStackPointerUp = () => {
    snapshotStartRef.current = null;
  };

  const captureSnapshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshotDraft || !onSaveSnapshot) return;
    const rectX = Math.max(0, Math.round(snapshotDraft.x));
    const rectY = Math.max(0, Math.round(snapshotDraft.y));
    const rectW = Math.min(canvas.width - rectX, Math.round(snapshotDraft.w));
    const rectH = Math.min(canvas.height - rectY, Math.round(snapshotDraft.h));
    if (rectW < 6 || rectH < 6) return;

    const out = document.createElement("canvas");
    out.width = rectW;
    out.height = rectH;
    const octx = out.getContext("2d");
    if (!octx) return;
    octx.drawImage(canvas, rectX, rectY, rectW, rectH, 0, 0, rectW, rectH);

    setSavingSnapshot(true);
    setSnapshotMessage(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Snapshot export failed");
      const file = new File(
        [blob],
        `${item.title}-p${currentPage}-snapshot.png`,
        { type: "image/png" },
      );
      const result = await onSaveSnapshot(file);
      setSnapshotMessage(
        result
          ? `Saved "${file.name}" to your file manager.`
          : "Couldn't save the snapshot.",
      );
    } catch (err) {
      console.error("Snapshot save failed", err);
      setSnapshotMessage("Couldn't save the snapshot.");
    } finally {
      setSavingSnapshot(false);
      setSnapshotDraft(null);
    }
  };

  // --- Download (with highlights baked in) ---------------------------------------

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadHighlightedPdf(
        item.src,
        `${item.title}-highlighted.pdf`,
        highlights,
      );
    } catch (err) {
      console.error("PDF download failed", err);
      setDownloadError("Couldn't prepare the download.");
    } finally {
      setDownloading(false);
    }
  };

  const pageHighlights = highlights.filter((h) => h.page === currentPage);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-100">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-linen-hover"
        >
          <CloseIcon className="size-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
          {item.title}
        </h2>

        {numPages > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className={iconBtnClass}
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <span className="w-16 text-center text-xs tabular-nums text-neutral-500">
              {currentPage} / {numPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              aria-label="Next page"
              className={iconBtnClass}
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
            }
            aria-label="Zoom out"
            className={iconBtnClass}
          >
            −
          </button>
          <span className="w-10 text-center text-xs text-neutral-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
            }
            aria-label="Zoom in"
            className={iconBtnClass}
          >
            +
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setTool("select")}
            className={modeBtnClass(tool === "select")}
          >
            <HighlighterIcon className="size-3.5" />
            Highlight
          </button>
          {onSaveSnapshot && (
            <button
              type="button"
              onClick={() => setTool("snapshot")}
              className={modeBtnClass(tool === "snapshot")}
            >
              <CameraIcon className="size-3.5" />
              Snapshot
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={downloading || !pdfDoc}
          title={
            highlights.length > 0
              ? "Download a copy with highlights baked in"
              : "Download this PDF"
          }
          className={`${toolBtnClass} shrink-0 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {downloading ? (
            <SpinnerIcon className="size-3.5 animate-spin" />
          ) : (
            <DownloadIcon className="size-3.5" />
          )}
          Download
        </button>

        {tool === "snapshot" && snapshotDraft && snapshotDraft.w > 2 && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void captureSnapshot()}
              disabled={savingSnapshot}
              className={primaryBtnClass}
            >
              {savingSnapshot && (
                <SpinnerIcon className="size-3.5 animate-spin" />
              )}
              Capture
            </button>
            <button
              type="button"
              onClick={() => setSnapshotDraft(null)}
              className={toolBtnClass}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {snapshotMessage && (
        <p className="shrink-0 bg-white px-4 py-1.5 text-center text-xs text-accent">
          {snapshotMessage}
        </p>
      )}
      {downloadError && (
        <p className="shrink-0 bg-white px-4 py-1.5 text-center text-xs text-red-600">
          {downloadError}
        </p>
      )}

      <div className="relative flex-1 overflow-auto p-8">
        {loadError ? (
          <p className="text-center text-sm text-red-600">{loadError}</p>
        ) : !pdfDoc ? (
          <div className="flex h-full items-center justify-center">
            <SpinnerIcon className="size-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <div className="mx-auto w-fit">
            <div
              onMouseUp={handleTextLayerMouseUp}
              onPointerDown={onStackPointerDown}
              onPointerMove={onStackPointerMove}
              onPointerUp={onStackPointerUp}
              onPointerLeave={onStackPointerUp}
              className="relative touch-none bg-white shadow-md"
            >
              <canvas ref={canvasRef} className="block" />
              <div
                ref={textLayerRef}
                className={`pdf-text-layer ${tool === "snapshot" ? "pointer-events-none" : ""}`}
              />

              {pageHighlights.map((h) => (
                <div
                  key={h.id}
                  className="absolute inset-0 pointer-events-none"
                >
                  {h.rects.map((r, i) => (
                    <div
                      key={i}
                      className="absolute rounded-sm"
                      style={{
                        left: `${r.x * 100}%`,
                        top: `${r.y * 100}%`,
                        width: `${r.w * 100}%`,
                        height: `${r.h * 100}%`,
                        backgroundColor: h.color,
                        mixBlendMode: "multiply",
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => void removeHighlight(h.id)}
                    title="Remove highlight"
                    aria-label="Remove highlight"
                    className="pointer-events-auto absolute flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900/70 text-white opacity-50 transition hover:opacity-100"
                    style={{
                      left: `${(h.rects[0].x + h.rects[0].w) * 100}%`,
                      top: `${h.rects[0].y * 100}%`,
                    }}
                  >
                    <CloseIcon className="size-2.5" />
                  </button>
                </div>
              ))}

              {snapshotDraft && snapshotDraft.w > 2 && snapshotDraft.h > 2 && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-accent bg-accent/10"
                  style={{
                    left: snapshotDraft.x,
                    top: snapshotDraft.y,
                    width: snapshotDraft.w,
                    height: snapshotDraft.h,
                  }}
                />
              )}

              {pendingSelection && (
                <div
                  className="absolute z-10 flex items-center gap-1 rounded-full bg-neutral-900 p-1.5 shadow-lg"
                  style={{
                    left: pendingSelection.anchorX,
                    top: pendingSelection.anchorY,
                    transform: "translate(-50%, -120%)",
                  }}
                >
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => void commitHighlight(color)}
                      title="Highlight this"
                      className="size-6 rounded-full ring-2 ring-white/40 transition hover:scale-110"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      window.getSelection()?.removeAllRanges();
                      setPendingSelection(null);
                    }}
                    aria-label="Cancel"
                    className="flex size-6 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10"
                  >
                    <CloseIcon className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtnClass =
  "flex size-7 items-center justify-center rounded-md text-neutral-600 transition hover:bg-linen-hover disabled:cursor-not-allowed disabled:opacity-30";

const toolBtnClass =
  "flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50";

const primaryBtnClass =
  "flex items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";

const modeBtnClass = (active: boolean) =>
  `flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
    active
      ? "bg-neutral-900 text-white"
      : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
  }`;
