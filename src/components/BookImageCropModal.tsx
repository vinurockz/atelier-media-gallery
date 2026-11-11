import { useRef, useState } from "react";
import type { BookCropRect } from "@/types/book";
import { CloseIcon } from "@/components/icons";

type Props = {
  src: string;
  initialCrop: BookCropRect | null;
  onApply: (crop: BookCropRect) => void;
  onClose: () => void;
};

const MIN_SIZE = 0.08;
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/** Simple non-destructive crop editor — drag the rectangle to move it, drag its corner to
 * resize it, against the full uncropped image shown at its natural aspect ratio (so the
 * 0-1 crop fractions map 1:1 onto screen position). No dependency: same pointer-drag
 * technique as moving/resizing an element on the page. */
export function BookImageCropModal({
  src,
  initialCrop,
  onApply,
  onClose,
}: Props) {
  const [aspect, setAspect] = useState<number | null>(null);
  const [crop, setCrop] = useState<BookCropRect>(
    initialCrop ?? { x: 0, y: 0, w: 1, h: 1 },
  );
  const boxRef = useRef<HTMLDivElement>(null);

  const beginMove = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startXFrac = (e.clientX - rect.left) / rect.width;
    const startYFrac = (e.clientY - rect.top) / rect.height;
    const origX = crop.x;
    const origY = crop.y;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - rect.left) / rect.width - startXFrac;
      const dy = (ev.clientY - rect.top) / rect.height - startYFrac;
      setCrop((c) => ({
        ...c,
        x: clamp(origX + dx, 0, 1 - c.w),
        y: clamp(origY + dy, 0, 1 - c.h),
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const beginResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const anchorX = crop.x;
    const anchorY = crop.y;

    const onMove = (ev: PointerEvent) => {
      const curXFrac = (ev.clientX - rect.left) / rect.width;
      const curYFrac = (ev.clientY - rect.top) / rect.height;
      setCrop((c) => ({
        ...c,
        w: clamp(curXFrac - anchorX, MIN_SIZE, 1 - anchorX),
        h: clamp(curYFrac - anchorY, MIN_SIZE, 1 - anchorY),
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-linen px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Crop image</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-linen-hover"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-neutral-100 p-4">
          <div
            ref={boxRef}
            className="relative mx-auto w-full max-w-md select-none bg-black"
            style={{ aspectRatio: aspect ?? 4 / 3 }}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setAspect(
                  e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
                )
              }
              className="h-full w-full object-contain opacity-50"
            />
            <div
              onPointerDown={beginMove}
              className="absolute cursor-move touch-none ring-2 ring-white"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                boxShadow: "0 0 0 1000px rgba(0,0,0,0.4)",
              }}
            >
              <div
                onPointerDown={beginResize}
                className="absolute -bottom-1.5 -right-1.5 size-4 cursor-nwse-resize touch-none rounded-full bg-white ring-2 ring-accent"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-linen px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-linen-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(crop)}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
          >
            Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}
