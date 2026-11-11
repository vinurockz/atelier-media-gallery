import { useRef, useState } from "react";
import type { useOrganization } from "@/hooks/useOrganization";
import type { useImportedMedia } from "@/hooks/useImportedMedia";
import { useFileDropZone } from "@/hooks/useFileDropZone";
import type { MediaItem } from "@/types/media";
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs";
import { EditableLabel } from "@/components/EditableLabel";
import { FolderGrid } from "@/components/FolderGrid";
import { PdfCard } from "@/components/PdfCard";
import { PdfViewer } from "@/components/PdfViewer";
import { PdfIcon, UploadIcon } from "@/components/icons";

interface PdfStoreViewProps {
  organization: ReturnType<typeof useOrganization>;
  importFiles: ReturnType<typeof useImportedMedia>["importFiles"];
  onDeleteItem: (item: MediaItem) => void;
  onSaveSnapshot?: (source: MediaItem, file: File) => Promise<MediaItem | null>;
}

/**
 * Landing page for the PDFs module: the exact same category/folder tree as
 * Files (same useOrganization instance), filtered down to just PDFs — so a
 * PDF uploaded here shows up in Files too, and vice versa, since both read
 * and write the one shared MediaItem/category store. Opening a PDF hands off
 * to PdfViewer, a full-screen reader/highlighter/snapshot tool.
 */
export function PdfStoreView({
  organization,
  importFiles,
  onDeleteItem,
  onSaveSnapshot,
}: PdfStoreViewProps) {
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(null);
  const [openFolderKey, setOpenFolderKey] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<MediaItem | null>(null);
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const category = openCategoryKey
    ? (organization.categories.find((c) => c.key === openCategoryKey) ?? null)
    : null;
  const folders = category ? organization.foldersByCategory(category.key) : [];
  const activeFolder =
    category && openFolderKey
      ? (folders.find((f) => f.key === openFolderKey) ?? null)
      : null;

  const pdfsInCategory = category
    ? organization
        .unsortedInCategory(category.key)
        .filter((item) => item.type === "pdf")
    : [];
  const pdfsInFolder =
    category && activeFolder
      ? organization
          .itemsInFolder(category.key, activeFolder.key)
          .filter((item) => item.type === "pdf")
      : [];

  /** Only .pdf files are let through here — anything else belongs in Files. */
  const importPdfs = async (categoryKey: string, files: File[]) => {
    const pdfFiles = files.filter((f) => /\.pdf$/i.test(f.name));
    const skipped = files.length - pdfFiles.length;
    if (pdfFiles.length === 0) {
      setDropMessage(
        "Only .pdf files can be added here — use Files for anything else.",
      );
      return null;
    }
    const result = await importFiles(categoryKey, pdfFiles);
    setDropMessage(
      `${result.imported} ${result.imported === 1 ? "PDF" : "PDFs"} added${
        skipped > 0 ? ` · ${skipped} non-PDF file(s) skipped` : ""
      }`,
    );
    return result;
  };

  const dropZone = useFileDropZone(async (files) => {
    if (category) {
      await importPdfs(category.key, files);
      return;
    }
    const key = organization.createCategory("Dropped PDFs");
    if (key) await importPdfs(key, files);
  });

  const goHome = () => {
    setOpenCategoryKey(null);
    setOpenFolderKey(null);
  };

  const deleteItem = (item: MediaItem) => {
    if (window.confirm(`Delete "${item.title}"? This can't be undone.`)) {
      onDeleteItem(item);
    }
  };

  const crumbs: Crumb[] = [
    { label: "PDFs", onClick: category ? goHome : undefined },
    ...(category
      ? [
          {
            label: category.name,
            onClick: activeFolder ? () => setOpenFolderKey(null) : undefined,
          },
        ]
      : []),
    ...(activeFolder ? [{ label: activeFolder.name }] : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <Breadcrumbs items={crumbs} />
        {category && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                void importPdfs(category.key, files).then((result) => {
                  if (result && activeFolder) {
                    result.items.forEach((item) =>
                      organization.moveItemToFolder(item.id, activeFolder.key),
                    );
                  }
                });
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
            >
              <UploadIcon className="size-3.5" />
              Upload PDF
            </button>
          </>
        )}
      </div>

      <main
        {...dropZone.handlers}
        className="relative flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6"
      >
        {dropZone.active && (
          <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-accent/10">
            <div className="flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
              <UploadIcon className="size-4" />
              Drop PDFs to add {category ? `to ${category.name}` : ""}
            </div>
          </div>
        )}

        {dropMessage && (
          <p className="mb-3 text-xs text-stone">{dropMessage}</p>
        )}

        {!category ? (
          <FolderGrid
            folders={organization.categories}
            onOpen={(key) => {
              setOpenCategoryKey(key);
              setOpenFolderKey(null);
            }}
            onRename={organization.renameCategory}
            onCreate={organization.createCategory}
            onDelete={organization.deleteCategory}
            deleteConfirmMessage={(name, count) =>
              `Delete "${name}"? Its ${count} ${count === 1 ? "item" : "items"} will move to "Uncategorized", not be deleted.`
            }
            newLabel="New category"
            colorFor={(key) => organization.getFolderColor(key, null)}
            onColorChange={(key, color) =>
              organization.setFolderColor(key, null, color)
            }
          />
        ) : activeFolder ? (
          <>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
              {activeFolder.name}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-400">
              {pdfsInFolder.length} {pdfsInFolder.length === 1 ? "PDF" : "PDFs"}{" "}
              in {category.name}
            </p>

            {pdfsInFolder.length === 0 ? (
              <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-14 text-center">
                <PdfIcon className="size-8 text-neutral-300" />
                <p className="mt-2 text-sm font-medium text-neutral-600">
                  No PDFs in this folder yet.
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Upload one, or drag a card here from "{category.name}".
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                {pdfsInFolder.map((item) => (
                  <PdfCard
                    key={item.id}
                    item={item}
                    onOpen={setOpenItem}
                    categories={organization.categories}
                    onMoveToCategory={organization.moveItem}
                    onCreateCategoryAndMove={(itemId, name) => {
                      const key = organization.createCategory(name);
                      if (key) organization.moveItem(itemId, key);
                    }}
                    folders={folders}
                    currentFolder={activeFolder.key}
                    onMoveToFolder={organization.moveItemToFolder}
                    onCreateFolderAndMove={(itemId, name) => {
                      const key = organization.createFolder(category.key, name);
                      if (key) organization.moveItemToFolder(itemId, key);
                    }}
                    onDelete={deleteItem}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <EditableLabel
                value={category.name}
                onCommit={(next) =>
                  organization.renameCategory(category.key, next)
                }
                className="text-2xl font-semibold tracking-tight text-neutral-900"
              />
            </div>

            <div className="mt-6">
              <h3 className="text-base font-semibold text-neutral-800">
                Folders
              </h3>
              <div className="mt-3">
                <FolderGrid
                  folders={folders}
                  onOpen={setOpenFolderKey}
                  onRename={(key, next) =>
                    organization.renameFolder(category.key, key, next)
                  }
                  onCreate={(name) =>
                    organization.createFolder(category.key, name)
                  }
                  onDelete={(key) =>
                    organization.deleteFolder(category.key, key)
                  }
                  onDropItem={(key, itemId) =>
                    organization.moveItemToFolder(itemId, key)
                  }
                  onDropFiles={async (key, files) => {
                    const result = await importPdfs(category.key, files);
                    result?.items.forEach((item) =>
                      organization.moveItemToFolder(item.id, key),
                    );
                  }}
                  newLabel="New folder"
                  colorFor={(key) =>
                    organization.getFolderColor(category.key, key)
                  }
                  onColorChange={(key, color) =>
                    organization.setFolderColor(category.key, key, color)
                  }
                />
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-base font-semibold text-neutral-800">
                {folders.length > 0 ? "Unsorted" : "PDFs"}
              </h3>
              {pdfsInCategory.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-400">
                  No PDFs directly in this category yet — upload one, or drop
                  files here.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                  {pdfsInCategory.map((item) => (
                    <PdfCard
                      key={item.id}
                      item={item}
                      onOpen={setOpenItem}
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
                        const key = organization.createFolder(
                          category.key,
                          name,
                        );
                        if (key) organization.moveItemToFolder(itemId, key);
                      }}
                      onDelete={deleteItem}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {openItem && (
        <PdfViewer
          item={openItem}
          onClose={() => setOpenItem(null)}
          onSaveSnapshot={
            onSaveSnapshot
              ? (file) => onSaveSnapshot(openItem, file)
              : undefined
          }
        />
      )}
    </div>
  );
}
