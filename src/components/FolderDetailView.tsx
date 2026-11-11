import { useState } from "react";
import type { CategorySummary, FolderSummary } from "@/hooks/useOrganization";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { useMediaColors } from "@/hooks/useMediaColors";
import { useMediaSizes } from "@/hooks/useMediaSizes";
import { useSelection } from "@/hooks/useSelection";
import { useFileDropZone } from "@/hooks/useFileDropZone";
import type { ViewMode } from "@/hooks/useViewMode";
import type { MediaItem } from "@/types/media";
import { EditableLabel } from "@/components/EditableLabel";
import { MediaTypeSection } from "@/components/MediaTypeSection";
import { MediaLightbox } from "@/components/MediaLightbox";
import { PdfCard } from "@/components/PdfCard";
import { PdfViewer } from "@/components/PdfViewer";
import { ZipToolbar } from "@/components/ZipToolbar";
import { SelectionToolbar } from "@/components/SelectionToolbar";
import { PdfIcon, TrashIcon, UploadIcon } from "@/components/icons";

interface FolderDetailViewProps {
  category: CategorySummary;
  folder: FolderSummary;
  items: MediaItem[];
  allFolders: FolderSummary[];
  categories: CategorySummary[];
  onRename: (next: string) => void;
  onDelete: () => void;
  onMoveToCategory: (itemId: string, categoryKey: string) => void;
  onCreateCategoryAndMove: (itemId: string, name: string) => void;
  onMoveToFolder: (itemId: string, folderKey: string | null) => void;
  onCreateFolderAndMove: (itemId: string, name: string) => void;
  onImportZip: (file: File) => Promise<ImportZipOutcome>;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
  onDeleteItem: (item: MediaItem) => void;
  /** Lets a PDF opened from here save a page snapshot back to the library, same as the PDFs module. */
  onSaveSnapshot?: (source: MediaItem, file: File) => Promise<MediaItem | null>;
  viewMode: ViewMode;
}

interface LightboxState {
  items: MediaItem[];
  index: number;
}

export function FolderDetailView({
  category,
  folder,
  items,
  allFolders,
  categories,
  onRename,
  onDelete,
  onMoveToCategory,
  onCreateCategoryAndMove,
  onMoveToFolder,
  onCreateFolderAndMove,
  onImportZip,
  onImportFiles,
  onDeleteItem,
  onSaveSnapshot,
  viewMode,
}: FolderDetailViewProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [openPdfItem, setOpenPdfItem] = useState<MediaItem | null>(null);
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  const selection = useSelection();
  const colors = useMediaColors(items);
  const sizes = useMediaSizes(items);

  const dropZone = useFileDropZone(async (files) => {
    const result = await onImportFiles(files);
    setDropMessage(
      `${result.imported} ${result.imported === 1 ? "file" : "files"} added${
        result.skipped.length > 0 ? ` · ${result.skipped.length} skipped` : ""
      }`,
    );
  });

  const videos = items.filter((item) => item.type === "video");
  const pictures = items.filter((item) => item.type === "image");
  const pdfs = items.filter((item) => item.type === "pdf");

  return (
    <div {...dropZone.handlers} className="relative">
      {dropZone.active && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-accent/10">
          <div className="flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
            <UploadIcon className="size-4" />
            Drop to add to {folder.name}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <EditableLabel
              value={folder.name}
              onCommit={onRename}
              className="text-2xl font-semibold tracking-tight text-neutral-900"
            />
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${folder.name}"? Its ${folder.count} ${folder.count === 1 ? "item" : "items"} will move back to Unsorted, not be deleted.`,
                  )
                ) {
                  onDelete();
                }
              }}
              title="Delete folder"
              className="flex size-6 items-center justify-center rounded-full text-neutral-300 transition hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </div>
          <p className="mt-0.5 text-sm text-neutral-400">
            {folder.count} {folder.count === 1 ? "item" : "items"} in{" "}
            {category.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selection.toggleMode}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              selection.active
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-linen-hover"
            }`}
          >
            {selection.active ? "Cancel select" : "Select"}
          </button>
          <ZipToolbar
            items={items}
            zipName={`${category.name}-${folder.name}`}
            onImport={onImportZip}
            importLabel="Import ZIP into folder"
          />
        </div>
      </div>
      {dropMessage && (
        <p className="mt-1 text-xs text-neutral-500">{dropMessage}</p>
      )}

      {items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-14 text-center">
          <p className="text-sm font-medium text-neutral-600">
            This folder is empty.
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Move a card here from the category, import a zip, or drop files
            here.
          </p>
        </div>
      ) : (
        <>
          <SelectionToolbar
            selection={selection}
            allItems={items}
            zipBaseName={`${category.name}-${folder.name}`}
            categories={categories}
            currentCategory={category.key}
            onMoveToCategory={(ids, key) =>
              ids.forEach((id) => onMoveToCategory(id, key))
            }
            onCreateCategoryAndMove={(ids, name) => {
              ids.forEach((id) => onCreateCategoryAndMove(id, name));
            }}
            folders={allFolders}
            currentFolder={folder.key}
            onMoveToFolder={(ids, key) =>
              ids.forEach((id) => onMoveToFolder(id, key))
            }
            onCreateFolderAndMove={(ids, name) => {
              ids.forEach((id) => onCreateFolderAndMove(id, name));
            }}
            onDelete={async (ids) => {
              for (const id of ids) {
                const item = items.find((i) => i.id === id);
                if (item) await onDeleteItem(item);
              }
            }}
          />
          <MediaTypeSection
            type="video"
            items={videos}
            colors={colors}
            sizes={sizes}
            onSelect={(list, index) => setLightbox({ items: list, index })}
            categories={categories}
            onMoveToCategory={onMoveToCategory}
            onCreateCategoryAndMove={onCreateCategoryAndMove}
            folders={allFolders}
            currentFolder={folder.key}
            onMoveToFolder={onMoveToFolder}
            onCreateFolderAndMove={onCreateFolderAndMove}
            onDelete={onDeleteItem}
            selection={selection}
            viewMode={viewMode}
          />
          <MediaTypeSection
            type="image"
            items={pictures}
            colors={colors}
            sizes={sizes}
            onSelect={(list, index) => setLightbox({ items: list, index })}
            categories={categories}
            onMoveToCategory={onMoveToCategory}
            onCreateCategoryAndMove={onCreateCategoryAndMove}
            folders={allFolders}
            currentFolder={folder.key}
            onMoveToFolder={onMoveToFolder}
            onCreateFolderAndMove={onCreateFolderAndMove}
            onDelete={onDeleteItem}
            selection={selection}
            viewMode={viewMode}
          />
          {pdfs.length > 0 && (
            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-800">
                <PdfIcon className="size-4 text-neutral-400" />
                Documents
                <span className="text-sm font-normal text-neutral-400">
                  {pdfs.length}
                </span>
              </h2>
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                {pdfs.map((item) => (
                  <PdfCard
                    key={item.id}
                    item={item}
                    onOpen={setOpenPdfItem}
                    categories={categories}
                    onMoveToCategory={onMoveToCategory}
                    onCreateCategoryAndMove={onCreateCategoryAndMove}
                    folders={allFolders}
                    currentFolder={folder.key}
                    onMoveToFolder={onMoveToFolder}
                    onCreateFolderAndMove={onCreateFolderAndMove}
                    onDelete={onDeleteItem}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {lightbox && (
        <MediaLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) =>
            setLightbox((prev) => (prev ? { ...prev, index } : prev))
          }
        />
      )}

      {openPdfItem && (
        <PdfViewer
          item={openPdfItem}
          onClose={() => setOpenPdfItem(null)}
          onSaveSnapshot={
            onSaveSnapshot
              ? (file) => onSaveSnapshot(openPdfItem, file)
              : undefined
          }
        />
      )}
    </div>
  );
}
