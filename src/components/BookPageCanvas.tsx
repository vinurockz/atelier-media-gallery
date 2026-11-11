import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type {
  BookElement,
  BookFontFamily,
  BookPage,
  BookShapeKind,
} from "@/types/book";
import type { MediaItem } from "@/types/media";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import { BookImageCropModal } from "@/components/BookImageCropModal";
import { BookPageElements } from "@/components/BookPageElements";
import { CustomColorSwatch } from "@/components/CustomColorSwatch";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AttachIcon,
  BoldIcon,
  CircleShapeIcon,
  CropIcon,
  ImageIcon,
  ItalicIcon,
  LineShapeIcon,
  RectShapeIcon,
  RotateIcon,
  SpinnerIcon,
  TextIcon,
  TrashIcon,
} from "@/components/icons";

type Props = {
  page: BookPage;
  mediaItems: MediaItem[];
  onChangeElements: (elements: BookElement[]) => void;
  onChangeBackground: (color: string) => void;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
};

const PAGE_BG_SWATCHES = [
  "#ffffff",
  "#fdf6e3",
  "#f3e8ff",
  "#e0f2fe",
  "#dcfce7",
  "#fee2e2",
  "#f1f5f9",
];
const TEXT_COLOR_SWATCHES = [
  "#171717",
  "#dc2626",
  "#1a73e8",
  "#16a34a",
  "#9333ea",
  "#ffffff",
];
const SHAPE_COLOR_SWATCHES = [
  "#1a73e8",
  "#dc2626",
  "#16a34a",
  "#eab308",
  "#9333ea",
  "#171717",
];
const FONT_OPTIONS: { value: BookFontFamily; label: string }[] = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function newTextElement(): BookElement {
  return {
    id: crypto.randomUUID(),
    type: "text",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    rotation: 0,
    text: "Text",
    fontSize: 24,
    fontFamily: "sans",
    color: "#171717",
    bold: false,
    italic: false,
    align: "left",
    mediaItemId: null,
  };
}

function newImageElement(mediaItemId: string): BookElement {
  return {
    id: crypto.randomUUID(),
    type: "image",
    x: 0.15,
    y: 0.15,
    width: 0.4,
    height: 0.3,
    rotation: 0,
    text: "",
    fontSize: 16,
    color: "#171717",
    bold: false,
    italic: false,
    align: "left",
    mediaItemId,
    crop: null,
  };
}

function newShapeElement(shapeKind: BookShapeKind): BookElement {
  return {
    id: crypto.randomUUID(),
    type: "shape",
    x: 0.2,
    y: 0.2,
    width: 0.3,
    height: shapeKind === "line" ? 0.02 : 0.2,
    rotation: 0,
    text: "",
    fontSize: 16,
    color: "#171717",
    bold: false,
    italic: false,
    align: "left",
    mediaItemId: null,
    shapeKind,
    fillColor: "#1a73e8",
  };
}

/** The editable view of one book page — drag elements to move them, drag their corner
 * handle to resize them (both committed as a single change on release, not per
 * pointermove frame), plus a side panel for the selected element's text/style/rotation/
 * crop and a toolbar to add new text/image/shape elements. */
export function BookPageCanvas({
  page,
  mediaItems,
  onChangeElements,
  onChangeBackground,
  onImportFiles,
}: Props) {
  const [draft, setDraft] = useState<BookElement[]>(page.elements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Switching pages clears the selection. Resyncing `draft` from `page.elements` is a
  // separate effect below, keyed on the elements themselves — including it here too would
  // mean every commit (e.g. the end of a drag) retriggers this effect and drops the
  // selection/side panel right after you move something.
  useEffect(() => {
    setSelectedId(null);
  }, [page.id]);

  useEffect(() => {
    setDraft(page.elements);
  }, [page.elements]);

  const selected = draft.find((el) => el.id === selectedId) ?? null;
  const selectedImage =
    selected?.type === "image" && selected.mediaItemId
      ? mediaItems.find((m) => m.id === selected.mediaItemId)
      : null;

  const commit = (next: BookElement[]) => {
    setDraft(next);
    onChangeElements(next);
  };

  const updateSelected = (patch: Partial<BookElement>) => {
    if (!selected) return;
    commit(
      draft.map((el) => (el.id === selected.id ? { ...el, ...patch } : el)),
    );
  };

  const removeSelected = () => {
    if (!selected) return;
    commit(draft.filter((el) => el.id !== selected.id));
    setSelectedId(null);
  };

  const addText = () => {
    const el = newTextElement();
    commit([...draft, el]);
    setSelectedId(el.id);
  };

  const addImage = (mediaItemId: string) => {
    const el = newImageElement(mediaItemId);
    commit([...draft, el]);
    setSelectedId(el.id);
    setShowAttach(false);
  };

  const addShape = (kind: BookShapeKind) => {
    const el = newShapeElement(kind);
    commit([...draft, el]);
    setSelectedId(el.id);
    setShowShapeMenu(false);
  };

  const handleDeviceUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      const result = await onImportFiles(files);
      const first = result.items[0];
      if (first) addImage(first.id);
    } finally {
      setUploading(false);
    }
  };

  const beginDrag = (e: React.PointerEvent, element: BookElement) => {
    e.preventDefault();
    setSelectedId(element.id);
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startXFrac = (e.clientX - rect.left) / rect.width;
    const startYFrac = (e.clientY - rect.top) / rect.height;
    const origX = element.x;
    const origY = element.y;
    let latest = draft;

    const onMove = (ev: PointerEvent) => {
      const curXFrac = (ev.clientX - rect.left) / rect.width;
      const curYFrac = (ev.clientY - rect.top) / rect.height;
      const nextX = clamp01(origX + (curXFrac - startXFrac));
      const nextY = clamp01(origY + (curYFrac - startYFrac));
      latest = latest.map((el) =>
        el.id === element.id ? { ...el, x: nextX, y: nextY } : el,
      );
      setDraft(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onChangeElements(latest);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const beginResize = (e: React.PointerEvent, element: BookElement) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    let latest = draft;

    const onMove = (ev: PointerEvent) => {
      const curXFrac = (ev.clientX - rect.left) / rect.width;
      const curYFrac = (ev.clientY - rect.top) / rect.height;
      const nextWidth = Math.max(
        0.05,
        Math.min(1 - element.x, curXFrac - element.x),
      );
      const nextHeight = Math.max(
        0.03,
        Math.min(1 - element.y, curYFrac - element.y),
      );
      latest = latest.map((el) =>
        el.id === element.id
          ? { ...el, width: nextWidth, height: nextHeight }
          : el,
      );
      setDraft(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onChangeElements(latest);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        <div className="relative flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={addText}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm ring-1 ring-black/5 hover:bg-linen-hover"
          >
            <TextIcon className="size-3.5" />
            Add text
          </button>
          <button
            type="button"
            onClick={() => setShowAttach(true)}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm ring-1 ring-black/5 hover:bg-linen-hover"
          >
            <ImageIcon className="size-3.5" />
            Library image
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm ring-1 ring-black/5 hover:bg-linen-hover disabled:opacity-50"
          >
            {uploading ? (
              <SpinnerIcon className="size-3.5 animate-spin" />
            ) : (
              <AttachIcon className="size-3.5" />
            )}
            Upload image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleDeviceUpload}
            className="hidden"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowShapeMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm ring-1 ring-black/5 hover:bg-linen-hover"
            >
              <RectShapeIcon className="size-3.5" />
              Add shape
            </button>
            {showShapeMenu && (
              <div className="absolute left-0 top-full z-10 mt-1 flex items-center gap-1 rounded-lg bg-white p-1.5 shadow-lg ring-1 ring-black/5">
                <button
                  type="button"
                  onClick={() => addShape("rectangle")}
                  title="Rectangle"
                  className="flex size-8 items-center justify-center rounded text-neutral-600 hover:bg-linen-hover"
                >
                  <RectShapeIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => addShape("ellipse")}
                  title="Ellipse"
                  className="flex size-8 items-center justify-center rounded text-neutral-600 hover:bg-linen-hover"
                >
                  <CircleShapeIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => addShape("line")}
                  title="Line"
                  className="flex size-8 items-center justify-center rounded text-neutral-600 hover:bg-linen-hover"
                >
                  <LineShapeIcon className="size-4" />
                </button>
              </div>
            )}
          </div>
          <span className="mx-1 h-4 w-px bg-neutral-300" />
          {PAGE_BG_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChangeBackground(c)}
              aria-label={`Page background ${c}`}
              aria-pressed={page.background === c}
              className={`size-5 rounded-full ring-1 ring-black/10 transition ${
                page.background === c ? "ring-2 ring-accent" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <CustomColorSwatch onChange={onChangeBackground} />
        </div>

        <div
          ref={pageRef}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
          className="relative aspect-[3/4] w-full max-w-[560px] shrink-0 rounded-sm shadow-lg ring-1 ring-black/10"
        >
          <BookPageElements
            page={{ ...page, elements: draft }}
            mediaItems={mediaItems}
            interactive={{ selectedId, onPointerDown: beginDrag }}
          />
          {selected && (
            <div
              onPointerDown={(e) => beginResize(e, selected)}
              className="absolute size-3.5 cursor-nwse-resize touch-none rounded-full bg-white ring-2 ring-accent"
              style={{
                left: `${(selected.x + selected.width) * 100}%`,
                top: `${(selected.y + (selected.height ?? 0.2)) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
        </div>
      </div>

      {selected && (
        <div className="w-72 shrink-0 space-y-3 overflow-y-auto border-l border-linen bg-white px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone">
              {selected.type === "text"
                ? "Text"
                : selected.type === "image"
                  ? "Image"
                  : "Shape"}
            </p>
            <button
              type="button"
              onClick={removeSelected}
              aria-label="Delete element"
              className="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </div>

          {selected.type === "text" && (
            <>
              <textarea
                value={selected.text}
                onChange={(e) => updateSelected({ text: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
              />
              <div>
                <span className="mb-1 block text-xs font-medium text-stone">
                  Font
                </span>
                <div className="flex items-center gap-1">
                  {FONT_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => updateSelected({ fontFamily: f.value })}
                      aria-pressed={(selected.fontFamily ?? "sans") === f.value}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        (selected.fontFamily ?? "sans") === f.value
                          ? "bg-accent/10 text-accent"
                          : "text-neutral-500 hover:bg-linen-hover"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateSelected({ bold: !selected.bold })}
                  aria-pressed={selected.bold}
                  className={`flex size-7 items-center justify-center rounded ${selected.bold ? "bg-accent/10 text-accent" : "text-neutral-500 hover:bg-linen-hover"}`}
                >
                  <BoldIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelected({ italic: !selected.italic })}
                  aria-pressed={selected.italic}
                  className={`flex size-7 items-center justify-center rounded ${selected.italic ? "bg-accent/10 text-accent" : "text-neutral-500 hover:bg-linen-hover"}`}
                >
                  <ItalicIcon className="size-3.5" />
                </button>
                <span className="mx-0.5 h-4 w-px bg-neutral-200" />
                {[
                  { align: "left" as const, Icon: AlignLeftIcon },
                  { align: "center" as const, Icon: AlignCenterIcon },
                  { align: "right" as const, Icon: AlignRightIcon },
                ].map(({ align, Icon }) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => updateSelected({ align })}
                    aria-pressed={selected.align === align}
                    className={`flex size-7 items-center justify-center rounded ${
                      selected.align === align
                        ? "bg-accent/10 text-accent"
                        : "text-neutral-500 hover:bg-linen-hover"
                    }`}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-stone">
                  Font size
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSelected({
                        fontSize: Math.max(10, selected.fontSize - 2),
                      })
                    }
                    className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-linen-hover"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm">
                    {selected.fontSize}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelected({
                        fontSize: Math.min(96, selected.fontSize + 2),
                      })
                    }
                    className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-linen-hover"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-stone">
                  Color
                </span>
                <div className="flex items-center gap-1.5">
                  {TEXT_COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateSelected({ color: c })}
                      aria-label={`Text color ${c}`}
                      aria-pressed={selected.color === c}
                      className={`size-5 rounded-full ring-1 ring-black/10 transition ${
                        selected.color === c ? "ring-2 ring-accent" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <CustomColorSwatch
                    onChange={(color) => updateSelected({ color })}
                  />
                </div>
              </div>
            </>
          )}

          {selected.type === "image" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAttach(true)}
                className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-accent/50 hover:text-accent"
              >
                Replace image
              </button>
              {selectedImage && (
                <button
                  type="button"
                  onClick={() => setCropping(true)}
                  className="flex items-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-600 hover:border-accent/50 hover:text-accent"
                >
                  <CropIcon className="size-3.5" />
                  Crop
                </button>
              )}
            </div>
          )}

          {selected.type === "shape" && (
            <div>
              <span className="mb-1 block text-xs font-medium text-stone">
                Color
              </span>
              <div className="flex items-center gap-1.5">
                {SHAPE_COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateSelected({ fillColor: c })}
                    aria-label={`Shape color ${c}`}
                    aria-pressed={selected.fillColor === c}
                    className={`size-5 rounded-full ring-1 ring-black/10 transition ${
                      selected.fillColor === c ? "ring-2 ring-accent" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <CustomColorSwatch
                  onChange={(fillColor) => updateSelected({ fillColor })}
                />
              </div>
            </div>
          )}

          <div>
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-stone">
              <RotateIcon className="size-3.5" />
              Rotation
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateSelected({ rotation: (selected.rotation ?? 0) - 15 })
                }
                className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-linen-hover"
              >
                −
              </button>
              <span className="w-10 text-center text-sm">
                {selected.rotation ?? 0}°
              </span>
              <button
                type="button"
                onClick={() =>
                  updateSelected({ rotation: (selected.rotation ?? 0) + 15 })
                }
                className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-linen-hover"
              >
                +
              </button>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400">
            Drag the blue dot on the page to resize.
          </p>
        </div>
      )}

      {showAttach && (
        <AttachMediaModal
          items={mediaItems}
          multiple={false}
          typeFilter="image"
          onClose={() => setShowAttach(false)}
          onConfirm={(ids) => {
            const id = ids[0];
            if (!id) {
              setShowAttach(false);
              return;
            }
            if (selected?.type === "image")
              updateSelected({ mediaItemId: id, crop: null });
            else addImage(id);
            setShowAttach(false);
          }}
        />
      )}

      {cropping && selectedImage && (
        <BookImageCropModal
          src={selectedImage.src}
          initialCrop={
            selected?.type === "image" ? (selected.crop ?? null) : null
          }
          onApply={(crop) => {
            updateSelected({ crop });
            setCropping(false);
          }}
          onClose={() => setCropping(false)}
        />
      )}
    </div>
  );
}
