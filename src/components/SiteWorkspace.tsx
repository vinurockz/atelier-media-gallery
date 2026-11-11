import { useEffect, useRef, useState } from "react";
import type { Site } from "@/types/website";
import type { MediaItem } from "@/types/media";
import type { SitePatch, SitePagePatch } from "@/lib/api/sites";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { useSitePages } from "@/hooks/useSitePages";
import {
  createLiveRenderContext,
  renderSitePageDocument,
} from "@/lib/websiteRender";
import { exportSiteAsZip } from "@/lib/siteExport";
import { SitePageCanvas } from "@/components/SitePageCanvas";
import {
  ChevronLeftIcon,
  DownloadIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

type Props = {
  site: Site;
  mediaItems: MediaItem[];
  onBack: () => void;
  onEditSite: (patch: SitePatch) => Promise<void>;
  onDeleteSite: () => void;
  onBumpPageCount: (delta: number) => void;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
  onBuilderOpenChange: (open: boolean) => void;
};

/** One open site: a page rail on the left (drag to reorder — new territory, Books'
 * pages are never reordered), and the open page's 3-pane block canvas on the right. */
export function SiteWorkspace({
  site,
  mediaItems,
  onBack,
  onEditSite,
  onDeleteSite,
  onBumpPageCount,
  onImportFiles,
  onBuilderOpenChange,
}: Props) {
  const { pages, loaded, addPage, updatePage, removePage, reorderPage } =
    useSitePages(site.id, onBumpPageCount);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [addPageError, setAddPageError] = useState<string | null>(null);
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
  const [dragInsertIndex, setDragInsertIndex] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(site.name);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [pageNameDraft, setPageNameDraft] = useState("");
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      loaded &&
      pages.length > 0 &&
      !pages.some((p) => p.id === currentPageId)
    ) {
      setCurrentPageId(pages[0].id);
    }
  }, [loaded, pages, currentPageId]);

  // Full-bleed editing surface (hides the Sidebar) while a page is open, same as the
  // Editor module's editorOpen — only while actually editing a page's blocks, not while
  // just browsing the page rail with nothing open.
  useEffect(() => {
    onBuilderOpenChange(currentPageId !== null);
    return () => onBuilderOpenChange(false);
  }, [currentPageId, onBuilderOpenChange]);

  const sortedPages = [...pages].sort((a, b) => a.index - b.index);
  const currentPage = sortedPages.find((p) => p.id === currentPageId) ?? null;

  const handleAddPage = async () => {
    setAddPageError(null);
    const id = await addPage();
    if (id) setCurrentPageId(id);
    else setAddPageError("Couldn't add page.");
  };

  const handleDeletePage = async (pageId: string) => {
    if (!window.confirm("Delete this page?")) return;
    await removePage(pageId);
    if (currentPageId === pageId) setCurrentPageId(null);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== site.name) await onEditSite({ name: trimmed });
    else setNameDraft(site.name);
    setRenaming(false);
  };

  const savePageName = async (pageId: string, currentTitle: string) => {
    const trimmed = pageNameDraft.trim();
    if (trimmed && trimmed !== currentTitle)
      await updatePage(pageId, { title: trimmed });
    setRenamingPageId(null);
  };

  // Drag-to-reorder: row rects are captured once at drag start (not re-measured mid-drag,
  // so shifting tiles never feed back into the hit-test), same "capture once, compute
  // deltas against that snapshot" idea as BookPageCanvas's beginDrag/beginResize — just
  // applied to a reorderable list instead of a free x/y position, which is new territory
  // here (Books never reorders its pages).
  const beginPageDrag = (e: React.PointerEvent, pageId: string) => {
    e.preventDefault();
    const rowEls = Array.from(
      railRef.current?.querySelectorAll<HTMLElement>("[data-page-row]") ?? [],
    );
    const rects = rowEls
      .filter((el) => el.dataset.pageRow !== pageId)
      .map((el) => ({
        id: el.dataset.pageRow!,
        rect: el.getBoundingClientRect(),
      }));
    const startY = e.clientY;
    let dragging = false;
    let latestIndex = sortedPages.findIndex((p) => p.id === pageId);

    const resolveIndex = (pointerY: number) => {
      for (let i = 0; i < rects.length; i++) {
        const mid = rects[i].rect.top + rects[i].rect.height / 2;
        if (pointerY < mid) return i;
      }
      return rects.length;
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientY - startY) > 4) dragging = true;
      if (!dragging) return;
      latestIndex = resolveIndex(ev.clientY);
      setDraggingPageId(pageId);
      setDragInsertIndex(latestIndex);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (dragging) {
        void reorderPage(pageId, latestIndex);
      } else {
        setCurrentPageId(pageId);
      }
      setDraggingPageId(null);
      setDragInsertIndex(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to websites"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover hover:text-ink"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setNameDraft(site.name);
                  setRenaming(false);
                }
              }}
              className="truncate rounded-md border border-accent/40 px-1.5 py-0.5 text-sm font-medium text-ink outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(site.name);
                setRenaming(true);
              }}
              className="truncate rounded-md px-1.5 py-0.5 text-sm font-medium text-ink hover:bg-linen-hover"
            >
              {site.name}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center rounded-full bg-canvas p-1 ring-1 ring-linen">
            {(["edit", "preview"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                  mode === m ? "bg-white text-accent shadow-sm" : "text-stone"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void exportSiteAsZip(site, pages, mediaItems)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover hover:text-ink"
          >
            <DownloadIcon className="size-3.5" />
            Export .zip
          </button>
          <button
            type="button"
            onClick={onDeleteSite}
            title="Delete site"
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          ref={railRef}
          className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-linen bg-white px-3 py-3"
        >
          {sortedPages.map((page, i) => (
            <div key={page.id}>
              {draggingPageId && dragInsertIndex === i && (
                <div className="my-1 h-0.5 rounded-full bg-accent" />
              )}
              <div data-page-row={page.id} className="group relative">
                {renamingPageId === page.id ? (
                  <input
                    autoFocus
                    value={pageNameDraft}
                    onChange={(e) => setPageNameDraft(e.target.value)}
                    onBlur={() => savePageName(page.id, page.title)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePageName(page.id, page.title);
                      if (e.key === "Escape") setRenamingPageId(null);
                    }}
                    className="w-full rounded-md border border-accent/40 px-2.5 py-2 text-xs font-medium outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onPointerDown={(e) => beginPageDrag(e, page.id)}
                    onDoubleClick={() => {
                      setPageNameDraft(page.title);
                      setRenamingPageId(page.id);
                    }}
                    title="Double-click to rename"
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-medium transition ${
                      currentPageId === page.id
                        ? "bg-accent/10 text-accent ring-1 ring-accent"
                        : "text-ink ring-1 ring-black/10 hover:ring-accent/40"
                    }`}
                  >
                    <span className="truncate">{page.title || "Untitled"}</span>
                    {i === 0 && (
                      <span className="shrink-0 rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] text-stone">
                        Home
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeletePage(page.id)}
                  aria-label="Delete page"
                  className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-white text-red-500 opacity-0 shadow ring-1 ring-black/5 transition hover:bg-red-50 group-hover:opacity-100"
                >
                  <TrashIcon className="size-3" />
                </button>
              </div>
            </div>
          ))}
          {draggingPageId && dragInsertIndex === sortedPages.length && (
            <div className="my-1 h-0.5 rounded-full bg-accent" />
          )}

          <button
            type="button"
            onClick={handleAddPage}
            className="flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-neutral-300 px-2.5 py-2 text-neutral-400 transition hover:border-accent/50 hover:text-accent"
          >
            <PlusIcon className="size-3.5" />
            <span className="text-xs font-medium">Add page</span>
          </button>
          {addPageError && (
            <p className="text-center text-[10px] text-red-500">
              {addPageError}
            </p>
          )}
        </div>

        {currentPage ? (
          mode === "edit" ? (
            <SitePageCanvas
              page={currentPage}
              pages={sortedPages}
              mediaItems={mediaItems}
              onChangePage={(patch: SitePagePatch) =>
                updatePage(currentPage.id, patch)
              }
              onImportFiles={onImportFiles}
            />
          ) : (
            // Rendered through the same WebsitePageBlocks tree as the editing canvas
            // (via renderSitePageDocument), in its own iframe for the same style
            // isolation reason the customHtml block uses one — this is the "what
            // you'll actually get" check before exporting.
            <iframe
              key={currentPage.id}
              title="Page preview"
              sandbox="allow-scripts"
              srcDoc={renderSitePageDocument(
                currentPage,
                createLiveRenderContext(sortedPages),
              )}
              className="flex-1 bg-white"
            />
          )
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
            {loaded ? "Add a page to get started." : "Loading…"}
          </div>
        )}
      </div>
    </div>
  );
}
