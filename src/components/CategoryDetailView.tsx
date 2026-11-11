import { useMemo, useState } from "react";
import type { useOrganization } from "@/hooks/useOrganization";
import type { useImportedMedia } from "@/hooks/useImportedMedia";
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
import { downloadItemsAsZip } from "@/lib/zip";
import { FolderGrid } from "@/components/FolderGrid";
import { FolderDetailView } from "@/components/FolderDetailView";
import { SelectionToolbar } from "@/components/SelectionToolbar";
import { PdfIcon, TrashIcon, UploadIcon } from "@/components/icons";

interface CategoryDetailViewProps {
  categoryKey: string;
  organization: ReturnType<typeof useOrganization>;
  importZip: ReturnType<typeof useImportedMedia>["importZip"];
  importFiles: ReturnType<typeof useImportedMedia>["importFiles"];
  onDeleteItem: (item: MediaItem) => void;
  /** Lets a PDF opened from here save a page snapshot back to the library, same as the PDFs module. */
  onSaveSnapshot?: (source: MediaItem, file: File) => Promise<MediaItem | null>;
  onBack: () => void;
  openFolder: string | null;
  onOpenFolder: (key: string | null) => void;
  viewMode: ViewMode;
}

interface LightboxState {
  items: MediaItem[];
  index: number;
}

export function CategoryDetailView({
  categoryKey,
  organization,
  importZip,
  importFiles,
  onDeleteItem,
  onSaveSnapshot,
  onBack,
  openFolder,
  onOpenFolder,
  viewMode,
}: CategoryDetailViewProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [openPdfItem, setOpenPdfItem] = useState<MediaItem | null>(null);
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  const selection = useSelection();

  const category = organization.categories.find((c) => c.key === categoryKey);
  const allItemsInCategory = useMemo(
    () => organization.items.filter((item) => item.category === categoryKey),
    [organization.items, categoryKey],
  );
  const folders = organization.foldersByCategory(categoryKey);
  const unsorted = organization.unsortedInCategory(categoryKey);

  const colors = useMediaColors(unsorted);
  const sizes = useMediaSizes(unsorted);

  const dropZone = useFileDropZone(async (files) => {
    const result = await importFiles(categoryKey, files);
    setDropMessage(
      `${result.imported} ${result.imported === 1 ? "file" : "files"} added${
        result.skipped.length > 0 ? ` · ${result.skipped.length} skipped` : ""
      }`,
    );
  });

  const activeFolder = openFolder
    ? folders.find((f) => f.key === openFolder)
    : null;

  const deleteItems = async (ids: string[]) => {
    for (const id of ids) {
      const item = organization.items.find((i) => i.id === id);
      if (item) await onDeleteItem(item);
    }
  };

  if (!category) return null;

  if (activeFolder) {
    return (
      <FolderDetailView
        category={category}
        folder={activeFolder}
        items={organization.itemsInFolder(categoryKey, activeFolder.key)}
        allFolders={folders}
        categories={organization.categories}
        onRename={(next) =>
          organization.renameFolder(categoryKey, activeFolder.key, next)
        }
        onDelete={() => {
          organization.deleteFolder(categoryKey, activeFolder.key);
          onOpenFolder(null);
        }}
        onMoveToCategory={organization.moveItem}
        onCreateCategoryAndMove={(itemId, name) => {
          const key = organization.createCategory(name);
          if (key) organization.moveItem(itemId, key);
        }}
        onMoveToFolder={organization.moveItemToFolder}
        onCreateFolderAndMove={(itemId, name) => {
          const key = organization.createFolder(categoryKey, name);
          if (key) organization.moveItemToFolder(itemId, key);
        }}
        onImportZip={async (file) => {
          const result = await importZip(categoryKey, file);
          result.items.forEach((item) =>
            organization.moveItemToFolder(item.id, activeFolder.key),
          );
          return result;
        }}
        onImportFiles={async (files) => {
          const result = await importFiles(categoryKey, files);
          result.items.forEach((item) =>
            organization.moveItemToFolder(item.id, activeFolder.key),
          );
          return result;
        }}
        onDeleteItem={onDeleteItem}
        onSaveSnapshot={onSaveSnapshot}
        viewMode={viewMode}
      />
    );
  }

  const videos = unsorted.filter((item) => item.type === "video");
  const pictures = unsorted.filter((item) => item.type === "image");
  const pdfs = unsorted.filter((item) => item.type === "pdf");

  return (
    <div {...dropZone.handlers} className="relative">
      {dropZone.active && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-accent/10">
          <div className="flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
            <UploadIcon className="size-4" />
            Drop to add to {category.name}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <EditableLabel
              value={category.name}
              onCommit={(next) =>
                organization.renameCategory(categoryKey, next)
              }
              className="text-2xl font-semibold tracking-tight text-neutral-900"
            />
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${category.name}"? Its ${category.count} ${category.count === 1 ? "item" : "items"} will move to "Uncategorized", not be deleted.`,
                  )
                ) {
                  organization.deleteCategory(categoryKey);
                  onBack();
                }
              }}
              title="Delete category"
              className="flex size-6 items-center justify-center rounded-full text-neutral-300 transition hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </div>
          <p className="mt-0.5 text-sm text-neutral-400">
            {category.count} {category.count === 1 ? "item" : "items"}
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
            items={allItemsInCategory}
            zipName={category.name}
            onImport={(file) => importZip(categoryKey, file)}
            importLabel="Import ZIP"
          />
        </div>
      </div>
      {dropMessage && (
        <p className="mt-1 text-xs text-neutral-500">{dropMessage}</p>
      )}

      <div className="mt-6">
        <h2 className="text-base font-semibold text-neutral-800">Folders</h2>
        <p className="mt-0.5 text-xs text-neutral-400">
          Drag a card onto a folder to move it in, or drop files from your
          computer to import them.
        </p>
        <div className="mt-3">
          <FolderGrid
            folders={folders}
            onOpen={onOpenFolder}
            onRename={(key, next) =>
              organization.renameFolder(categoryKey, key, next)
            }
            onCreate={(name) => organization.createFolder(categoryKey, name)}
            onDelete={(key) => organization.deleteFolder(categoryKey, key)}
            onDropItem={(key, itemId) =>
              organization.moveItemToFolder(itemId, key)
            }
            onDropFiles={async (key, files) => {
              const result = await importFiles(categoryKey, files);
              result.items.forEach((item) =>
                organization.moveItemToFolder(item.id, key),
              );
            }}
            onDownloadZip={(key) => {
              const folder = folders.find((f) => f.key === key);
              if (!folder) return;
              void downloadItemsAsZip(
                organization.itemsInFolder(categoryKey, key),
                `${category.name} - ${folder.name}`,
              );
            }}
            newLabel="New folder"
            viewMode={viewMode}
            colorFor={(key) => organization.getFolderColor(categoryKey, key)}
            onColorChange={(key, color) =>
              organization.setFolderColor(categoryKey, key, color)
            }
          />
        </div>
      </div>

      {unsorted.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">
          No videos, pictures, or PDFs directly in this category yet — move one
          in from another category's card menu, import a zip, or drop files
          here.
        </p>
      ) : (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-800">
              {folders.length > 0 ? "Unsorted" : "Items"}
            </h2>
          </div>
          <SelectionToolbar
            selection={selection}
            allItems={unsorted}
            zipBaseName={category.name}
            categories={organization.categories}
            currentCategory={categoryKey}
            onMoveToCategory={(ids, key) =>
              ids.forEach((id) => organization.moveItem(id, key))
            }
            onCreateCategoryAndMove={(ids, name) => {
              const key = organization.createCategory(name);
              if (key) ids.forEach((id) => organization.moveItem(id, key));
            }}
            folders={folders}
            currentFolder={null}
            onMoveToFolder={(ids, key) =>
              ids.forEach((id) => organization.moveItemToFolder(id, key))
            }
            onCreateFolderAndMove={(ids, name) => {
              const key = organization.createFolder(categoryKey, name);
              if (key)
                ids.forEach((id) => organization.moveItemToFolder(id, key));
            }}
            onDelete={deleteItems}
          />
          <MediaTypeSection
            type="video"
            items={videos}
            colors={colors}
            sizes={sizes}
            onSelect={(list, index) => setLightbox({ items: list, index })}
            categories={organization.categories}
            onMoveToCategory={organization.moveItem}
            onCreateCategoryAndMove={(itemId, name) => {
              const key = organization.createCategory(name);
              if (key) organization.moveItem(itemId, key);
            }}
            folders={folders}
            currentFolder={null}
            onMoveToFolder={organization.moveItemToFolder}
            onCreateFolderAndMove={(itemId, name) => {
              const key = organization.createFolder(categoryKey, name);
              if (key) organization.moveItemToFolder(itemId, key);
            }}
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
            categories={organization.categories}
            onMoveToCategory={organization.moveItem}
            onCreateCategoryAndMove={(itemId, name) => {
              const key = organization.createCategory(name);
              if (key) organization.moveItem(itemId, key);
            }}
            folders={folders}
            currentFolder={null}
            onMoveToFolder={organization.moveItemToFolder}
            onCreateFolderAndMove={(itemId, name) => {
              const key = organization.createFolder(categoryKey, name);
              if (key) organization.moveItemToFolder(itemId, key);
            }}
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
                    categories={organization.categories}
                    onMoveToCategory={organization.moveItem}
                    onCreateCategoryAndMove={(itemId, name) => {
                      const key = organization.createCategory(name);
                      if (key) organization.moveItem(itemId, key);
                    }}
                    folders={folders}
                    currentFolder={null}
                    onMoveToFolder={organization.moveItemToFolder}
                    onCreateFolderAndMove={(itemId, name) => {
                      const key = organization.createFolder(categoryKey, name);
                      if (key) organization.moveItemToFolder(itemId, key);
                    }}
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
