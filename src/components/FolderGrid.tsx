import { useState } from "react";
import type { MediaItem } from "@/types/media";
import { COLOR_ORDER, COLOR_SWATCHES } from "@/lib/color";
import type { ViewMode } from "@/hooks/useViewMode";
import { FolderTile } from "@/components/FolderTile";
import { FolderListRow } from "@/components/FolderListRow";
import { NewFolderTile } from "@/components/NewFolderTile";
import { CustomColorSwatch } from "@/components/CustomColorSwatch";
import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "@/components/ContextMenu";
import { useContextMenu } from "@/hooks/useContextMenu";
import {
  DownloadIcon,
  FolderIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/icons";

interface FolderLike {
  key: string;
  name: string;
  count: number;
  videoCount: number;
  imageCount: number;
  pdfCount: number;
  cover: MediaItem | null;
}

interface FolderGridProps {
  folders: FolderLike[];
  onOpen: (key: string) => void;
  onRename: (key: string, next: string) => void;
  onCreate: (name: string) => void;
  onDelete?: (key: string) => void;
  onDropItem?: (key: string, itemId: string) => void;
  onDropFiles?: (key: string, files: File[]) => void;
  /** Present once a folder has items worth exporting — adds a "Download ZIP" entry to its context menu. */
  onDownloadZip?: (key: string) => void;
  newLabel: string;
  deleteConfirmMessage?: (name: string, count: number) => string;
  viewMode?: ViewMode;
  colorFor?: (key: string) => string | null;
  onColorChange?: (key: string, color: string | null) => void;
}

/** A grid (or list) of folder tiles — used for the home screen (categories) and for folders inside a category. */
export function FolderGrid({
  folders,
  onOpen,
  onRename,
  onCreate,
  onDelete,
  onDropItem,
  onDropFiles,
  onDownloadZip,
  newLabel,
  deleteConfirmMessage,
  viewMode = "grid",
  colorFor,
  onColorChange,
}: FolderGridProps) {
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const menu = useContextMenu<FolderLike>();

  const contextMenu = menu.state && (
    <ContextMenu x={menu.state.x} y={menu.state.y} onClose={menu.close}>
      <ContextMenuButton
        icon={FolderIcon}
        label="Open"
        onClick={() => {
          onOpen(menu.state!.payload.key);
          menu.close();
        }}
      />
      <ContextMenuButton
        icon={PencilIcon}
        label="Rename"
        onClick={() => {
          setRenamingKey(menu.state!.payload.key);
          menu.close();
        }}
      />
      {onDownloadZip && menu.state!.payload.count > 0 && (
        <ContextMenuButton
          icon={DownloadIcon}
          label="Download ZIP"
          onClick={() => {
            onDownloadZip(menu.state!.payload.key);
            menu.close();
          }}
        />
      )}
      {onColorChange && (
        <>
          <ContextMenuDivider />
          <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Folder color
          </p>
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            <button
              type="button"
              title="No color"
              onClick={() => {
                onColorChange(menu.state!.payload.key, null);
                menu.close();
              }}
              className="flex size-5 items-center justify-center rounded-full bg-white ring-1 ring-neutral-300"
            >
              <span className="size-2.5 rounded-full bg-neutral-200" />
            </button>
            {COLOR_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => {
                  onColorChange(menu.state!.payload.key, COLOR_SWATCHES[c]);
                  menu.close();
                }}
                className="size-5 rounded-full ring-1 ring-black/10 transition hover:scale-110"
                style={{ backgroundColor: COLOR_SWATCHES[c] }}
              />
            ))}
            <CustomColorSwatch
              onChange={(color) => {
                onColorChange(menu.state!.payload.key, color);
                menu.close();
              }}
            />
          </div>
        </>
      )}
      {onDelete && (
        <>
          <ContextMenuDivider />
          <ContextMenuButton
            icon={TrashIcon}
            label="Delete"
            danger
            onClick={() => {
              const { key, name, count } = menu.state!.payload;
              const message =
                deleteConfirmMessage?.(name, count) ?? `Delete "${name}"?`;
              if (window.confirm(message)) onDelete(key);
              menu.close();
            }}
          />
        </>
      )}
    </ContextMenu>
  );

  if (viewMode === "list") {
    return (
      <>
        <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => (
            <FolderListRow
              key={folder.key}
              folder={folder}
              onOpen={() => onOpen(folder.key)}
              onRename={(next) => onRename(folder.key, next)}
              onDelete={onDelete ? () => onDelete(folder.key) : undefined}
              onDropItem={
                onDropItem
                  ? (itemId) => onDropItem(folder.key, itemId)
                  : undefined
              }
              onDropFiles={
                onDropFiles
                  ? (files) => onDropFiles(folder.key, files)
                  : undefined
              }
              deleteConfirmMessage={deleteConfirmMessage}
              color={colorFor?.(folder.key)}
              onContextMenu={(e) => menu.open(e, folder)}
              editing={renamingKey === folder.key}
              onEditingChange={(editing) =>
                setRenamingKey(editing ? folder.key : null)
              }
            />
          ))}
          <NewFolderTile label={newLabel} onCreate={onCreate} variant="row" />
        </div>
        {contextMenu}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {folders.map((folder) => (
          <FolderTile
            key={folder.key}
            folder={folder}
            onOpen={() => onOpen(folder.key)}
            onRename={(next) => onRename(folder.key, next)}
            onDelete={onDelete ? () => onDelete(folder.key) : undefined}
            onDropItem={
              onDropItem
                ? (itemId) => onDropItem(folder.key, itemId)
                : undefined
            }
            onDropFiles={
              onDropFiles
                ? (files) => onDropFiles(folder.key, files)
                : undefined
            }
            deleteConfirmMessage={deleteConfirmMessage}
            color={colorFor?.(folder.key)}
            onContextMenu={(e) => menu.open(e, folder)}
            editing={renamingKey === folder.key}
            onEditingChange={(editing) =>
              setRenamingKey(editing ? folder.key : null)
            }
          />
        ))}
        <NewFolderTile label={newLabel} onCreate={onCreate} />
      </div>
      {contextMenu}
    </>
  );
}
