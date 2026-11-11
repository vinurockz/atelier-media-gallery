import type { BookElement, BookFontFamily, BookPage } from "@/types/book";
import type { MediaItem } from "@/types/media";

type Props = {
  page: BookPage;
  mediaItems: MediaItem[];
  /** Renders a selection outline + lets the caller intercept pointerdown per element —
   * omitted entirely for read-only contexts (the reader, print export). */
  interactive?: {
    selectedId: string | null;
    onPointerDown: (e: React.PointerEvent, element: BookElement) => void;
  };
};

const FONT_STACKS: Record<BookFontFamily, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', Times, serif",
  mono: "'Courier New', Courier, monospace",
};

/** Pure, read-only-by-default render of one page's background + positioned elements — the
 * single source of truth for page layout, reused by the editable canvas, the flip-animated
 * reader, and the print/PDF export, so they can never visually disagree. */
export function BookPageElements({ page, mediaItems, interactive }: Props) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: page.background }}
    >
      {page.elements.map((el) => {
        const selected = interactive?.selectedId === el.id;
        const rotation = el.rotation ?? 0;
        const boxStyle: React.CSSProperties = {
          position: "absolute",
          left: `${el.x * 100}%`,
          top: `${el.y * 100}%`,
          width: `${el.width * 100}%`,
          height: el.height !== undefined ? `${el.height * 100}%` : undefined,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
        };
        const handlers = interactive
          ? {
              onPointerDown: (e: React.PointerEvent) =>
                interactive.onPointerDown(e, el),
            }
          : {};
        const selectedClass = selected ? "ring-2 ring-accent" : "";
        const interactiveClass = interactive ? "cursor-move touch-none" : "";

        if (el.type === "shape") {
          const fill = el.fillColor ?? "#1a73e8";
          if (el.shapeKind === "line") {
            return (
              <div
                key={el.id}
                style={boxStyle}
                {...handlers}
                className={`${interactiveClass} ${selectedClass}`}
              >
                <div className="h-1 w-full" style={{ backgroundColor: fill }} />
              </div>
            );
          }
          return (
            <div
              key={el.id}
              style={{
                ...boxStyle,
                backgroundColor: fill,
                borderRadius: el.shapeKind === "ellipse" ? "50%" : 0,
              }}
              {...handlers}
              className={`${interactiveClass} ${selectedClass}`}
            />
          );
        }

        if (el.type === "image") {
          const item = el.mediaItemId
            ? mediaItems.find((m) => m.id === el.mediaItemId)
            : null;
          return (
            <div
              key={el.id}
              style={boxStyle}
              {...handlers}
              className={`overflow-hidden ${interactiveClass} ${selectedClass}`}
            >
              {item ? (
                el.crop ? (
                  // Oversized, positioned image inside an overflow-hidden box — the
                  // standard dependency-free way to show only a cropped region.
                  <div className="relative h-full w-full">
                    <img
                      src={item.src}
                      alt=""
                      draggable={false}
                      style={{
                        position: "absolute",
                        width: `${100 / el.crop.w}%`,
                        height: `${100 / el.crop.h}%`,
                        left: `${(-el.crop.x / el.crop.w) * 100}%`,
                        top: `${(-el.crop.y / el.crop.h) * 100}%`,
                        maxWidth: "none",
                      }}
                    />
                  </div>
                ) : el.height !== undefined ? (
                  <img
                    src={item.src}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={item.src}
                    alt=""
                    draggable={false}
                    className="w-full"
                  />
                )
              ) : (
                <div className="flex h-full min-h-10 w-full items-center justify-center bg-neutral-200 text-xs text-neutral-400">
                  No image
                </div>
              )}
            </div>
          );
        }

        return (
          <div
            key={el.id}
            style={{
              ...boxStyle,
              color: el.color,
              fontSize: el.fontSize,
              fontFamily: FONT_STACKS[el.fontFamily ?? "sans"],
              fontWeight: el.bold ? 700 : 400,
              fontStyle: el.italic ? "italic" : "normal",
              textAlign: el.align,
              lineHeight: 1.3,
            }}
            {...handlers}
            className={`whitespace-pre-wrap break-words ${interactiveClass} ${selectedClass}`}
          >
            {el.text || (interactive ? "Text" : "")}
          </div>
        );
      })}
    </div>
  );
}
