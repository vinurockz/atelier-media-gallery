import { useState } from "react";
import type { Site } from "@/types/website";
import type { MediaItem } from "@/types/media";
import type { SitePatch } from "@/lib/api/sites";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { SiteWorkspace } from "@/components/SiteWorkspace";
import { NewFolderTile } from "@/components/NewFolderTile";
import { LayoutIcon, TrashIcon } from "@/components/icons";

type Props = {
  sites: Site[];
  mediaItems: MediaItem[];
  onCreate: (name: string) => Promise<string | null>;
  onEditSite: (id: string, patch: SitePatch) => Promise<void>;
  onDeleteSite: (id: string) => void;
  onBumpPageCount: (id: string, delta: number) => void;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
  onBuilderOpenChange: (open: boolean) => void;
};

/** Grid of sites — mirrors BooksView.tsx's book grid. Clicking one opens SiteWorkspace,
 * where its pages live (fetched lazily, not here). */
export function WebsitesView({
  sites,
  mediaItems,
  onCreate,
  onEditSite,
  onDeleteSite,
  onBumpPageCount,
  onImportFiles,
  onBuilderOpenChange,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openSite = openId ? (sites.find((s) => s.id === openId) ?? null) : null;

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}"? Its pages will be deleted too.`)) {
      if (openId === id) setOpenId(null);
      onDeleteSite(id);
    }
  };

  if (openSite) {
    return (
      <SiteWorkspace
        site={openSite}
        mediaItems={mediaItems}
        onBack={() => setOpenId(null)}
        onEditSite={(patch) => onEditSite(openSite.id, patch)}
        onDeleteSite={() => handleDelete(openSite.id, openSite.name)}
        onBumpPageCount={(delta) => onBumpPageCount(openSite.id, delta)}
        onImportFiles={onImportFiles}
        onBuilderOpenChange={onBuilderOpenChange}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <LayoutIcon className="size-4 text-stone" />
        <h1 className="text-base font-medium text-ink">Websites</h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {sites.map((site) => (
            <div key={site.id} className="group relative">
              <button
                type="button"
                onClick={() => setOpenId(site.id)}
                className="flex aspect-[4/3] w-full flex-col justify-end overflow-hidden rounded-lg text-left ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ backgroundColor: site.themeColor ?? "#1a73e8" }}
              >
                <div className="flex-1" />
                <div className="bg-black/25 px-2 py-2">
                  <p className="truncate text-xs font-semibold text-white">
                    {site.name}
                  </p>
                  <p className="text-[10px] text-white/80">
                    {site.pageCount} {site.pageCount === 1 ? "page" : "pages"}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(site.id, site.name)}
                aria-label="Delete site"
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-white text-red-500 opacity-0 shadow ring-1 ring-black/5 transition hover:bg-red-50 group-hover:opacity-100"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
          ))}
          <NewFolderTile label="New site" onCreate={onCreate} />
        </div>
      </div>
    </div>
  );
}
