import type { ReactNode } from "react";
import {
  ChevronLeftIcon,
  RedoIcon,
  SpinnerIcon,
  UndoIcon,
} from "@/components/icons";

interface EditorTopBarProps {
  title: string;
  onCancel: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
  /** Tool-mode buttons (Select/Draw/Crop/Pick), rendered centered. */
  children?: ReactNode;
}

/** Shopify-admin-editor-style top bar: back, title, tools, undo/redo, zoom, save — shared by both editors. */
export function EditorTopBar({
  title,
  onCancel,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  onSave,
  saving,
  saveLabel = "Save to file manager",
  children,
}: EditorTopBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          title="Back"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <span className="truncate text-sm font-medium text-neutral-800">
          {title}
        </span>
      </div>

      {children && <div className="flex items-center gap-1.5">{children}</div>}

      <div className="flex shrink-0 items-center gap-1.5">
        {onUndo && onRedo && (
          <>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo"
              className={iconBtnClass}
            >
              <UndoIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo"
              className={iconBtnClass}
            >
              <RedoIcon className="size-4" />
            </button>
          </>
        )}
        {zoom !== undefined && onZoomChange && (
          <>
            <div className="mx-1 h-5 w-px bg-neutral-200" />
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
              className={iconBtnClass}
            >
              −
            </button>
            <span className="w-10 text-center text-xs text-neutral-500">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(2.5, zoom + 0.25))}
              className={iconBtnClass}
            >
              +
            </button>
          </>
        )}
        <div className="mx-1 h-5 w-px bg-neutral-200" />
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <SpinnerIcon className="size-3.5 animate-spin" />}
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

const iconBtnClass =
  "flex size-7 items-center justify-center rounded-md text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40";
