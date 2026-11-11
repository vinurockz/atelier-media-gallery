import type {
  EditorLayer,
  ImageDoc,
  ImageSelection,
  SectionKey,
} from "@/types/editor";
import { SECTION_DEFS } from "@/lib/sections";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  ChatIcon,
  CircleShapeIcon,
  ImageIcon,
  LineShapeIcon,
  RectShapeIcon,
  TextIcon,
  TrashIcon,
} from "@/components/icons";

interface ImageLayersPanelProps {
  doc: ImageDoc;
  selection: ImageSelection;
  onSelect: (selection: ImageSelection) => void;
  onAddLayer: (
    kind: EditorLayer["kind"],
    y: number,
    presetText?: string,
  ) => void;
  onAddImages: () => void;
  onDeleteLayer: (id: string) => void;
  onTogglePhoto: (enabled: boolean) => void;
  onToggleSection: (key: SectionKey, enabled: boolean) => void;
}

const ADD_TOOLS: {
  kind: EditorLayer["kind"];
  icon: typeof TextIcon;
  title: string;
}[] = [
  { kind: "text", icon: TextIcon, title: "Add text" },
  { kind: "bubble", icon: ChatIcon, title: "Add speech bubble" },
  { kind: "rect", icon: RectShapeIcon, title: "Add rectangle" },
  { kind: "ellipse", icon: CircleShapeIcon, title: "Add ellipse" },
  { kind: "line", icon: LineShapeIcon, title: "Add line" },
];

function layerLabel(layer: EditorLayer): string {
  switch (layer.kind) {
    case "text":
      return layer.text || "Text";
    case "bubble":
      return layer.text || "Speech bubble";
    case "sticker":
      return `${layer.text} Sticker`;
    case "rect":
      return "Rectangle";
    case "ellipse":
      return "Ellipse";
    case "line":
      return "Line";
    case "image":
      return "Image";
  }
}

function LayerIcon({ layer }: { layer: EditorLayer }) {
  switch (layer.kind) {
    case "text":
      return <TextIcon className="size-3.5 shrink-0 text-neutral-400" />;
    case "bubble":
      return <ChatIcon className="size-3.5 shrink-0 text-neutral-400" />;
    case "sticker":
      return (
        <span className="w-3.5 shrink-0 text-center text-xs leading-none">
          {layer.text}
        </span>
      );
    case "rect":
      return <RectShapeIcon className="size-3.5 shrink-0 text-neutral-400" />;
    case "ellipse":
      return <CircleShapeIcon className="size-3.5 shrink-0 text-neutral-400" />;
    case "line":
      return <LineShapeIcon className="size-3.5 shrink-0 text-neutral-400" />;
    case "image":
      return <ImageIcon className="size-3.5 shrink-0 text-neutral-400" />;
  }
}

const rowClass = (active: boolean) =>
  `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
    active
      ? "bg-accent/10 text-accent"
      : "text-neutral-700 hover:bg-neutral-100"
  }`;

/** Shopify-editor-style left tree: Photo, sections (header, sides, caption, footer...), draggable layers. */
export function ImageLayersPanel({
  doc,
  selection,
  onSelect,
  onAddLayer,
  onAddImages,
  onDeleteLayer,
  onTogglePhoto,
  onToggleSection,
}: ImageLayersPanelProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white">
      <div className="flex items-center gap-1 border-b border-neutral-200 px-3 py-2">
        {ADD_TOOLS.map(({ kind, icon: Icon, title }) => (
          <button
            key={kind}
            type="button"
            title={title}
            onClick={() => onAddLayer(kind, 0.5)}
            className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            <Icon className="size-4" />
          </button>
        ))}
        <button
          type="button"
          title="Add sticker"
          onClick={() => onAddLayer("sticker", 0.5, "😀")}
          className="flex size-7 items-center justify-center rounded-md text-sm transition hover:bg-neutral-100"
        >
          😀
        </button>
        <button
          type="button"
          title="Add image(s)"
          onClick={onAddImages}
          className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
        >
          <ImageIcon className="size-4" />
        </button>
      </div>

      <div className="flex-1 px-2 py-2">
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={() => onSelect({ type: "photo" })}
            className={`flex flex-1 items-center gap-2 text-left text-sm ${
              selection.type === "photo" ? "text-accent" : "text-neutral-700"
            }`}
          >
            <ImageIcon className="size-3.5 shrink-0 text-neutral-400" />
            Photo
          </button>
          <ToggleSwitch
            checked={doc.photo.enabled}
            onChange={onTogglePhoto}
            label="Photo enabled"
          />
        </div>

        <div className="mb-1 mt-3 px-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          Sections
        </div>
        <div className="flex flex-col gap-1.5">
          {SECTION_DEFS.map(({ key, label }) => {
            const active =
              selection.type === "section" && selection.key === key;
            return (
              <div key={key} className="flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => onSelect({ type: "section", key })}
                  className={`flex-1 text-left text-sm ${active ? "text-accent" : "text-neutral-700"}`}
                >
                  {label}
                </button>
                <ToggleSwitch
                  checked={doc.sections[key].enabled}
                  onChange={(enabled) => onToggleSection(key, enabled)}
                  label={`${label} enabled`}
                />
              </div>
            );
          })}
        </div>

        {doc.layers.length > 0 && (
          <div className="mb-1 mt-3 px-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Layers
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {doc.layers.map((layer) => (
            <div key={layer.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => onSelect({ type: "layer", id: layer.id })}
                className={`${rowClass(selection.type === "layer" && selection.id === layer.id)} min-w-0 flex-1`}
              >
                <LayerIcon layer={layer} />
                <span className="min-w-0 flex-1 truncate">
                  {layerLabel(layer)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteLayer(layer.id)}
                title="Delete layer"
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
