import { useMemo, useState } from "react";
import type { Customer } from "@/types/customer";
import { mediaItems } from "@/lib/media";
import { useOrganization } from "@/hooks/useOrganization";
import { useImportedMedia, titleFromFilename } from "@/hooks/useImportedMedia";
import { useFileDropZone } from "@/hooks/useFileDropZone";
import { useViewMode } from "@/hooks/useViewMode";
import { useChat } from "@/hooks/useChat";
import { useNotes } from "@/hooks/useNotes";
import { useTextChats } from "@/hooks/useTextChats";
import { useBills } from "@/hooks/useBills";
import { useBooks } from "@/hooks/useBooks";
import { useTasks } from "@/hooks/useTasks";
import { useMovies } from "@/hooks/useMovies";
import { useSlideshows } from "@/hooks/useSlideshows";
import { useSites } from "@/hooks/useSites";
import { useApiHistory } from "@/hooks/useApiHistory";
import { useCustomEndpoints } from "@/hooks/useCustomEndpoints";
import { useReports } from "@/hooks/useReports";
import type { MediaItem } from "@/types/media";
import type { AppModule } from "@/types/module";
import {
  downloadBackupZip,
  downloadItemsAsZip,
  extractBackupZip,
} from "@/lib/zip";
import { exportContentPdf } from "@/lib/api/chat";
import { FolderGrid } from "@/components/FolderGrid";
import { CategoryDetailView } from "@/components/CategoryDetailView";
import { ChatView } from "@/components/ChatView";
import { NotesView } from "@/components/NotesView";
import { TextChatView } from "@/components/TextChatView";
import { BillsView } from "@/components/BillsView";
import { BooksView } from "@/components/BooksView";
import { TasksView } from "@/components/TasksView";
import { PdfStoreView } from "@/components/PdfStoreView";
import { MoviesView } from "@/components/MoviesView";
import { SlideshowsView } from "@/components/SlideshowsView";
import { WebsitesView } from "@/components/WebsitesView";
import { ApiTesterView } from "@/components/ApiTesterView";
import { CustomApisView } from "@/components/CustomApisView";
import { ReportsView } from "@/components/ReportsView";
import { EditorView } from "@/components/EditorView";
import { Sidebar } from "@/components/Sidebar";
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs";
import { ViewToggle } from "@/components/ViewToggle";
import { ChatIcon, FilmIcon, MenuIcon, UploadIcon } from "@/components/icons";

type Props = {
  customer: Customer;
  onLeaveCustomer: () => void;
  onLogout: () => void;
};

/**
 * Everything the app actually does, once a customer is active — unchanged from the
 * pre-auth App.tsx, just rendered per-customer. App.tsx mounts this with
 * `key={customer.id}` so switching customers remounts every hook fresh (new fetches, no
 * state bleeding from the previous customer) instead of trying to reset ~15 hooks by hand.
 */
export function Workspace({ customer, onLeaveCustomer, onLogout }: Props) {
  const importedMedia = useImportedMedia();
  const baseItems = useMemo(
    () => [...mediaItems, ...importedMedia.items],
    [importedMedia.items],
  );
  const organization = useOrganization(baseItems);
  const chat = useChat();
  const notes = useNotes();
  const textChats = useTextChats();
  const bills = useBills();
  const books = useBooks();
  const tasks = useTasks();
  const movies = useMovies();
  const slideshows = useSlideshows();
  const websites = useSites();
  const apiHistory = useApiHistory();
  const customEndpoints = useCustomEndpoints();
  const reports = useReports();
  const [module, setModule] = useState<AppModule>("files");
  const [editorOpen, setEditorOpen] = useState(false);
  const [websiteBuilderOpen, setWebsiteBuilderOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useViewMode();
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  // Below the `sm` breakpoint the sidebar is a slide-over drawer (see Sidebar.tsx) instead
  // of a static column, opened from the mobile top bar below.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const handleModuleChange = (next: AppModule) => {
    setModule(next);
    setMobileNavOpen(false);
  };

  const handleSendMessage = (text: string, attachmentIds: string[]) => {
    if (!chat.activeUserId) return;
    chat.sendMessage(chat.activeUserId, text, attachmentIds);
  };

  const activeContent =
    chat.contents.find((c) => c.id === chat.activeContentId) ?? null;
  const handleExportPdf = () => {
    if (!activeContent) return;
    void exportContentPdf(
      activeContent.id,
      activeContent.name,
      chat.activeUserId,
    );
  };

  // Files uploaded straight from the chat composer land in the file manager
  // too, under a dedicated category, rather than existing only in chat.
  const chatImportFiles = async (files: File[]) => {
    const key = organization.createCategory("Chat uploads");
    if (!key) {
      return {
        imported: 0,
        items: [],
        skipped: files.map((f) => ({
          filename: f.name,
          reason: "couldn't create category",
        })),
      };
    }
    return importedMedia.importFiles(key, files);
  };

  // Same deal for images uploaded straight from a book page — they land in the file
  // manager too, not just on that page.
  const bookImportFiles = async (files: File[]) => {
    const key = organization.createCategory("Book uploads");
    if (!key) {
      return {
        imported: 0,
        items: [],
        skipped: files.map((f) => ({
          filename: f.name,
          reason: "couldn't create category",
        })),
      };
    }
    return importedMedia.importFiles(key, files);
  };

  // Images uploaded from a task land in the file manager too, like chat/book uploads.
  const taskImportFiles = async (files: File[]) => {
    const key = organization.createCategory("Task uploads");
    if (!key) {
      return {
        imported: 0,
        items: [],
        skipped: files.map((f) => ({
          filename: f.name,
          reason: "couldn't create category",
        })),
      };
    }
    return importedMedia.importFiles(key, files);
  };

  // Images/videos uploaded from a Text Chat sentence land in the file manager too, under
  // a category named after that conversation (rather than a fixed "X uploads" name) so
  // each conversation's media stays grouped under its own name.
  const textChatImportFiles = async (
    conversationName: string,
    files: File[],
  ) => {
    const key =
      organization.createCategory(conversationName) ?? conversationName;
    return importedMedia.importFiles(key, files);
  };

  // Images/videos uploaded from a website block land in the file manager too, like
  // chat/book/task uploads.
  const websiteImportFiles = async (files: File[]) => {
    const key = organization.createCategory("Website uploads");
    if (!key) {
      return {
        imported: 0,
        items: [],
        skipped: files.map((f) => ({
          filename: f.name,
          reason: "couldn't create category",
        })),
      };
    }
    return importedMedia.importFiles(key, files);
  };

  // Images/videos uploaded straight from a Movie's "Add scene" step land in the file
  // manager too, like chat/book/task/website uploads.
  const movieImportFiles = async (files: File[]) => {
    const key = organization.createCategory("Movie uploads");
    if (!key) {
      return {
        imported: 0,
        items: [],
        skipped: files.map((f) => ({
          filename: f.name,
          reason: "couldn't create category",
        })),
      };
    }
    return importedMedia.importFiles(key, files);
  };

  // Same deal for files uploaded straight from the Slideshow creation wizard or an open
  // slideshow's "Add scene" step — its own category, separate from Movie uploads.
  const slideshowImportFiles = async (files: File[]) => {
    const key = organization.createCategory("Slideshow uploads");
    if (!key) {
      return {
        imported: 0,
        items: [],
        skipped: files.map((f) => ({
          filename: f.name,
          reason: "couldn't create category",
        })),
      };
    }
    return importedMedia.importFiles(key, files);
  };

  // An edited photo/video is saved as a new file alongside its source,
  // never replacing it. Returns the new MediaItem so the Editor can mark its
  // session "completed" and link to the result.
  const saveEditedMedia = async (source: MediaItem, file: File) => {
    const categoryKey =
      organization.createCategory(source.category) ?? source.category;
    const result = await importedMedia.importFiles(categoryKey, [file]);
    return result.items[0] ?? null;
  };

  // An exported movie is a new file too, not tied to any one clip's source category.
  const saveMovieExport = async (file: File) => {
    const key = organization.createCategory("Movie exports") ?? "Movie exports";
    const result = await importedMedia.importFiles(key, [file]);
    return result.items[0] ?? null;
  };

  // Same deal for an exported slideshow, its own category.
  const saveSlideshowExport = async (file: File) => {
    const key =
      organization.createCategory("Slideshow exports") ?? "Slideshow exports";
    const result = await importedMedia.importFiles(key, [file]);
    return result.items[0] ?? null;
  };

  const addMovie = (title: string) => movies.addMovie(title, "16:9");

  const goHome = () => {
    setOpenCategory(null);
    setOpenFolder(null);
  };
  const openCategoryAndReset = (key: string) => {
    setOpenCategory(key);
    setOpenFolder(null);
  };

  const downloadCategoryZip = (categoryKey: string) => {
    const category = organization.categories.find((c) => c.key === categoryKey);
    if (!category) return;
    const items = organization.items.filter(
      (item) => item.category === categoryKey,
    );
    void downloadItemsAsZip(items, category.name);
  };

  const deleteItem = async (item: MediaItem) => {
    organization.deleteItem(item.id);
    if (item.id.startsWith("imported:")) {
      await importedMedia.deleteItem(item.id);
    }
  };

  // Every category/folder's media, laid out as Category[/Folder] so a
  // restore can rebuild the exact same structure.
  const exportAll = async () => {
    const entries = organization.categories.flatMap((cat) => {
      const unsorted = organization.unsortedInCategory(cat.key).map((item) => ({
        item,
        category: cat.name,
        folder: null as string | null,
      }));
      const inFolders = organization
        .foldersByCategory(cat.key)
        .flatMap((folder) =>
          organization.itemsInFolder(cat.key, folder.key).map((item) => ({
            item,
            category: cat.name,
            folder: folder.name,
          })),
        );
      return [...unsorted, ...inFolders];
    });
    await downloadBackupZip(entries, "media-gallery-backup");
  };

  // Restores a backup zip (or any zip laid out as Category/Folder/file),
  // recreating categories/folders instead of dumping everything in one place.
  const importBackup = async (file: File) => {
    const { entries, skipped } = await extractBackupZip(file);

    // The bundled assets this backup covers are still shipped with the app,
    // so blindly re-importing would duplicate every filesystem-origin item.
    // For anything that already exists (by title + type), just reposition it
    // to match the backup's category/folder instead of importing a copy.
    const existingByTitleType = new Map<string, MediaItem>();
    organization.items.forEach((item) => {
      existingByTitleType.set(
        `${item.title.toLowerCase()}::${item.type}`,
        item,
      );
    });

    const toImport: typeof entries = [];
    let repositioned = 0;
    for (const entry of entries) {
      const title = titleFromFilename(entry.filename);
      const existing = existingByTitleType.get(
        `${title.toLowerCase()}::${entry.type}`,
      );
      if (!existing) {
        toImport.push(entry);
        continue;
      }
      const categoryKey = organization.createCategory(entry.category);
      if (categoryKey) {
        if (existing.category !== categoryKey)
          organization.moveItem(existing.id, categoryKey);
        const folderKey = entry.folder
          ? organization.createFolder(categoryKey, entry.folder)
          : null;
        organization.moveItemToFolder(existing.id, folderKey);
      }
      repositioned++;
    }

    const groups = new Map<
      string,
      { category: string; folder: string | null; files: File[] }
    >();
    toImport.forEach((entry) => {
      const key = `${entry.category}::${entry.folder ?? ""}`;
      const group = groups.get(key) ?? {
        category: entry.category,
        folder: entry.folder,
        files: [],
      };
      group.files.push(
        new File([entry.blob], entry.filename, { type: entry.blob.type }),
      );
      groups.set(key, group);
    });

    let imported = 0;
    for (const group of groups.values()) {
      const categoryKey = organization.createCategory(group.category);
      if (!categoryKey) continue;
      const result = await importedMedia.importFiles(categoryKey, group.files);
      imported += result.imported;
      if (group.folder) {
        const folderKey = organization.createFolder(categoryKey, group.folder);
        if (folderKey)
          result.items.forEach((item) =>
            organization.moveItemToFolder(item.id, folderKey),
          );
      }
    }

    const allSkipped =
      repositioned > 0
        ? [
            ...skipped,
            {
              filename: "",
              reason: `${repositioned} already here, repositioned`,
            },
          ]
        : skipped;
    return { imported, skipped: allSkipped };
  };

  // Dropping files on the home screen (outside any folder tile) imports them
  // into a brand-new category named after the drop.
  const dropZone = useFileDropZone(async (files) => {
    const key = organization.createCategory("Dropped files");
    if (!key) return;
    const result = await importedMedia.importFiles(key, files);
    setDropMessage(
      `${result.imported} ${result.imported === 1 ? "file" : "files"} added to "${key}"${
        result.skipped.length > 0 ? ` · ${result.skipped.length} skipped` : ""
      }`,
    );
  });

  const category = openCategory
    ? (organization.categories.find((c) => c.key === openCategory) ?? null)
    : null;
  const folder =
    category && openFolder
      ? (organization
          .foldersByCategory(category.key)
          .find((f) => f.key === openFolder) ?? null)
      : null;

  const crumbs: Crumb[] = [
    { label: "Archive", onClick: category ? goHome : undefined },
    ...(category
      ? [
          {
            label: category.name,
            onClick: folder ? () => setOpenFolder(null) : undefined,
          },
        ]
      : []),
    ...(folder ? [{ label: folder.name }] : []),
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <div className="flex items-center gap-3 border-b border-linen bg-surface px-4 py-3 sm:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink transition hover:bg-linen-hover"
        >
          <MenuIcon className="size-5" />
        </button>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-surface">
          <FilmIcon className="size-3.5" />
        </span>
        <span className="truncate font-serif text-base leading-none text-ink">
          Atelier
        </span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {!(module === "editor" && editorOpen) &&
          !(module === "websites" && websiteBuilderOpen) && (
            <Sidebar
              module={module}
              onModuleChange={handleModuleChange}
              categories={organization.categories}
              onExportAll={exportAll}
              onImportBackup={importBackup}
              activeContentId={chat.activeContentId}
              users={chat.users}
              activeUserId={chat.activeUserId}
              onSelectUser={chat.setActiveUser}
              onAddUser={chat.addUser}
              customerName={customer.name}
              onLeaveCustomer={onLeaveCustomer}
              onLogout={onLogout}
              mobileOpen={mobileNavOpen}
              onCloseMobile={() => setMobileNavOpen(false)}
            />
          )}

        <div className="flex min-w-0 flex-1 flex-col">
          {module === "files" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-surface px-4 py-3 sm:px-6 sm:py-3.5">
              <Breadcrumbs items={crumbs} />
              <ViewToggle mode={viewMode} onChange={setViewMode} />
            </div>
          ) : module === "chat" && !activeContent ? (
            <div className="flex items-center gap-2.5 border-b border-linen bg-surface px-4 py-3 sm:px-6 sm:py-3.5">
              <ChatIcon className="size-4 text-stone" />
              <h1 className="font-serif text-[1.05rem] text-ink">Chat</h1>
            </div>
          ) : null}

          {module === "files" ? (
            <main
              {...(openCategory ? {} : dropZone.handlers)}
              className="relative flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6"
            >
              {!openCategory && dropZone.active && (
                <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-ink/5">
                  <div className="flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-medium text-surface shadow-lifted">
                    <UploadIcon className="size-4" />
                    Drop to add a new category
                  </div>
                </div>
              )}

              {openCategory ? (
                <CategoryDetailView
                  categoryKey={openCategory}
                  organization={organization}
                  importZip={importedMedia.importZip}
                  importFiles={importedMedia.importFiles}
                  onDeleteItem={deleteItem}
                  onSaveSnapshot={saveEditedMedia}
                  onBack={goHome}
                  openFolder={openFolder}
                  onOpenFolder={setOpenFolder}
                  viewMode={viewMode}
                />
              ) : (
                <>
                  <h1 className="mb-6 font-serif text-[1.75rem] text-ink">
                    Your archive
                  </h1>
                  {dropMessage && (
                    <p className="mb-3 text-xs text-stone">{dropMessage}</p>
                  )}
                  <FolderGrid
                    folders={organization.categories}
                    onOpen={openCategoryAndReset}
                    onRename={organization.renameCategory}
                    onCreate={organization.createCategory}
                    onDelete={organization.deleteCategory}
                    onDropItem={(key, itemId) =>
                      organization.moveItem(itemId, key)
                    }
                    onDropFiles={(key, files) =>
                      importedMedia.importFiles(key, files)
                    }
                    onDownloadZip={downloadCategoryZip}
                    deleteConfirmMessage={(name, count) =>
                      `Delete "${name}"? Its ${count} ${count === 1 ? "item" : "items"} will move to "Uncategorized", not be deleted.`
                    }
                    newLabel="New category"
                    viewMode={viewMode}
                    colorFor={(key) => organization.getFolderColor(key, null)}
                    onColorChange={(key, color) =>
                      organization.setFolderColor(key, null, color)
                    }
                  />
                </>
              )}
            </main>
          ) : module === "chat" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <ChatView
                contentName={activeContent?.name ?? null}
                contents={chat.contents}
                onSelectContent={chat.selectContent}
                onCreateContent={chat.addContent}
                onEditContent={chat.editContent}
                onDeleteContent={chat.removeContent}
                onBackToContents={chat.clearActiveContent}
                users={chat.users}
                activeUserId={chat.activeUserId}
                messages={chat.messages}
                mediaItems={organization.items}
                onSend={handleSendMessage}
                onImportFiles={chatImportFiles}
                onEditMessage={chat.editMessage}
                onDeleteMessage={chat.deleteMessage}
                onExportPdf={handleExportPdf}
              />
            </main>
          ) : module === "notes" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <NotesView
                notes={notes.notes}
                mediaItems={organization.items}
                onCreate={notes.addNote}
                onPatch={notes.patchNote}
                onFlush={notes.flushNote}
                onDelete={notes.removeNote}
              />
            </main>
          ) : module === "textChats" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <TextChatView
                conversations={textChats.conversations}
                mediaItems={organization.items}
                onCreate={textChats.addConversation}
                onPatch={textChats.patchConversation}
                onFlush={textChats.flushConversation}
                onDelete={textChats.removeConversation}
                onCombine={textChats.combineConversations}
                onImportFiles={textChatImportFiles}
              />
            </main>
          ) : module === "bills" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <BillsView
                bills={bills.bills}
                mediaItems={organization.items}
                onCreate={bills.addBill}
                onSave={bills.editBill}
                onDelete={bills.removeBill}
              />
            </main>
          ) : module === "books" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <BooksView
                books={books.books}
                mediaItems={organization.items}
                onCreate={books.addBook}
                onEditBook={books.editBook}
                onDeleteBook={books.removeBook}
                onBumpPageCount={books.bumpPageCount}
                onImportFiles={bookImportFiles}
              />
            </main>
          ) : module === "tasks" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <TasksView
                sections={tasks.sections}
                tasks={tasks.tasks}
                mediaItems={organization.items}
                onAddSection={tasks.addSection}
                onPatchSection={tasks.patchSection}
                onRemoveSection={tasks.removeSection}
                onAddTask={tasks.addTask}
                onPatchTask={tasks.patchTask}
                onFlushTask={tasks.flushTask}
                onMoveTask={tasks.moveTask}
                onRemoveTask={tasks.removeTask}
                onImportFiles={taskImportFiles}
              />
            </main>
          ) : module === "pdfs" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <PdfStoreView
                organization={organization}
                importFiles={importedMedia.importFiles}
                onDeleteItem={(item) => void deleteItem(item)}
                onSaveSnapshot={saveEditedMedia}
              />
            </main>
          ) : module === "movies" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <MoviesView
                movies={movies.movies}
                mediaItems={organization.items}
                onCreate={addMovie}
                onPatchMovie={movies.patchMovie}
                onFlushMovie={movies.flushMovie}
                onDeleteMovie={(id) => void movies.removeMovie(id)}
                onSaveExport={saveMovieExport}
                onEditMedia={saveEditedMedia}
                onImportFiles={movieImportFiles}
              />
            </main>
          ) : module === "slideshows" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <SlideshowsView
                slideshows={slideshows.slideshows}
                mediaItems={organization.items}
                categories={organization.categories}
                onCreate={slideshows.addSlideshow}
                onPatch={slideshows.patchSlideshow}
                onFlush={slideshows.flushSlideshow}
                onDelete={(id) => void slideshows.removeSlideshow(id)}
                onSaveExport={saveSlideshowExport}
                onEditMedia={saveEditedMedia}
                onImportFiles={slideshowImportFiles}
              />
            </main>
          ) : module === "websites" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <WebsitesView
                sites={websites.sites}
                mediaItems={organization.items}
                onCreate={websites.addSite}
                onEditSite={websites.editSite}
                onDeleteSite={websites.removeSite}
                onBumpPageCount={websites.bumpPageCount}
                onImportFiles={websiteImportFiles}
                onBuilderOpenChange={setWebsiteBuilderOpen}
              />
            </main>
          ) : module === "api" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <ApiTesterView
                history={apiHistory.history}
                onAddHistoryEntry={apiHistory.addEntry}
                onRemoveHistoryEntry={apiHistory.removeEntry}
                onClearHistory={apiHistory.clearHistory}
              />
            </main>
          ) : module === "customApis" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <CustomApisView
                customerId={customer.id}
                endpoints={customEndpoints.endpoints}
                onCreate={customEndpoints.addEndpoint}
                onPatch={customEndpoints.patchEndpoint}
                onFlush={customEndpoints.flushEndpoint}
                onDelete={customEndpoints.removeEndpoint}
              />
            </main>
          ) : module === "reports" ? (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <ReportsView
                summary={reports.summary}
                loading={reports.loading}
                error={reports.error}
                onRefresh={() => void reports.refresh()}
              />
            </main>
          ) : (
            <main className="relative flex-1 overflow-hidden bg-canvas">
              <EditorView
                mediaItems={organization.items}
                onSave={saveEditedMedia}
                onEditingChange={setEditorOpen}
              />
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
