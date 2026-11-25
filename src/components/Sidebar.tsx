import { useEffect, useRef, useState, type SVGProps } from "react";
import type { CategorySummary } from "@/hooks/useOrganization";
import type { ChatUser } from "@/types/chat";
import type { AppModule } from "@/types/module";
import {
  BookIcon,
  ChartIcon,
  ChatIcon,
  ChevronRightIcon,
  ClapperboardIcon,
  CloseIcon,
  CodeIcon,
  FilmIcon,
  FolderIcon,
  ImagesIcon,
  LayoutIcon,
  MessagesSquareIcon,
  NoteIcon,
  PdfIcon,
  PlugIcon,
  PlusIcon,
  ReceiptIcon,
  ScissorsIcon,
  TaskBoardIcon,
} from "@/components/icons";
import { BackupToolbar } from "@/components/BackupToolbar";

type IconType = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
type NavLeaf = { kind: "item"; id: AppModule; label: string; Icon: IconType };
type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  items: Omit<NavLeaf, "kind">[];
};

// Grouped so the rail stays short with this many modules — Files is the default landing
// spot so it stays a standalone top-level item; everything else is grouped by what it's
// for and tucked behind a collapsible header, accordion-style (see openGroup below).
const NAV_ENTRIES: (NavLeaf | NavGroup)[] = [
  { kind: "item", id: "files", label: "Files", Icon: FolderIcon },
  {
    kind: "group",
    id: "communicate",
    label: "Communicate",
    items: [
      { id: "teams", label: "Teams", Icon: MessagesSquareIcon },
      { id: "chat", label: "Chat", Icon: ChatIcon },
      { id: "textChats", label: "Text Chat", Icon: MessagesSquareIcon },
    ],
  },
  {
    kind: "group",
    id: "create",
    label: "Create",
    items: [
      { id: "notes", label: "Notes", Icon: NoteIcon },
      { id: "bills", label: "Bills", Icon: ReceiptIcon },
      { id: "books", label: "Books", Icon: BookIcon },
      { id: "tasks", label: "Tasks", Icon: TaskBoardIcon },
    ],
  },
  {
    kind: "group",
    id: "media",
    label: "Media",
    items: [
      { id: "pdfs", label: "PDFs", Icon: PdfIcon },
      { id: "movies", label: "Movies", Icon: ClapperboardIcon },
      { id: "slideshows", label: "Slideshow", Icon: ImagesIcon },
      { id: "websites", label: "Websites", Icon: LayoutIcon },
    ],
  },
  {
    kind: "group",
    id: "tools",
    label: "Tools",
    items: [
      { id: "editor", label: "Edit", Icon: ScissorsIcon },
      { id: "api", label: "API Tester", Icon: PlugIcon },
      { id: "customApis", label: "Custom APIs", Icon: CodeIcon },
      { id: "reports", label: "Reports", Icon: ChartIcon },
    ],
  },
];

interface SidebarProps {
  module: AppModule;
  onModuleChange: (module: AppModule) => void;

  // Files module — category browsing/creation lives in the main panel (FolderGrid);
  // the sidebar only needs the count for the backup toolbar's disabled state.
  categories: CategorySummary[];
  onExportAll: () => Promise<void>;
  onImportBackup: (file: File) => Promise<{
    imported: number;
    skipped: { filename: string; reason: string }[];
  }>;

  // Chat module — content browsing/creation lives in the main panel (ContentGrid);
  // the sidebar only picks who you're chatting as within the open content.
  activeContentId: string | null;
  users: ChatUser[];
  activeUserId: string | null;
  onSelectUser: (id: string) => void;
  onAddUser: (name: string) => void;

  // Account footer — which customer this whole workspace is inside, plus a way back to
  // the customer picker and to sign out entirely.
  customerName: string;
  onLeaveCustomer: () => void;
  onLogout: () => void;

  // Below the `sm` breakpoint the rail becomes a slide-over drawer instead of a static
  // column — Workspace owns whether it's open (toggled from its mobile top bar) since the
  // same state also needs to close the drawer again once a module/user is picked.
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

type CreateMode = "user" | null;

const navClass = (active: boolean) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
    active
      ? "bg-accent-soft text-accent"
      : "text-ink/75 hover:bg-linen-hover hover:text-ink"
  }`;

/** The app's left rail — a module switcher, plus either the category list (Files) or the user list (Chat). */
export function Sidebar({
  module,
  onModuleChange,
  categories,
  onExportAll,
  onImportBackup,
  activeContentId,
  users,
  activeUserId,
  onSelectUser,
  onAddUser,
  customerName,
  onLeaveCustomer,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [creating, setCreating] = useState<CreateMode>(null);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Accordion — only one group open at a time. Starts with whichever group holds the
  // current module (so a deep-linked/initial module is never hidden behind a collapsed
  // group); the user's own toggles afterward are respected since this only ever runs
  // once, on mount.
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    const match = NAV_ENTRIES.find(
      (entry) =>
        entry.kind === "group" && entry.items.some((i) => i.id === module),
    );
    return match?.id ?? null;
  });
  const toggleGroup = (id: string) =>
    setOpenGroup((prev) => (prev === id ? null : id));

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setCreating(null);
      return;
    }
    if (creating === "user") onAddUser(trimmed);
    setName("");
    // Stays open so you can add several in a row without re-clicking "+" each time.
    inputRef.current?.focus();
  };

  const createInput = (placeholder: string) => (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-linen bg-surface px-3 py-2">
      <PlusIcon className="size-4 shrink-0 text-accent" />
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setName("");
            setCreating(null);
          }
        }}
        onBlur={submit}
        placeholder={placeholder}
        className="w-full min-w-0 text-sm text-ink outline-none placeholder:text-stone/60"
      />
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 sm:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-linen bg-surface px-3 py-5 transition-transform duration-200 sm:static sm:z-auto sm:flex sm:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-surface">
            <FilmIcon className="size-4" />
          </span>
          <span className="truncate font-serif text-[1.2rem] leading-none text-ink">
            Atelier
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover sm:hidden"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <nav
          role="group"
          aria-label="Section"
          className="mb-6 flex flex-col gap-0.5"
        >
          {NAV_ENTRIES.map((entry) => {
            if (entry.kind === "item") {
              const active = module === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onModuleChange(entry.id)}
                  className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-ink/75 hover:bg-linen-hover hover:text-ink"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                  )}
                  <entry.Icon className="size-4 shrink-0" />
                  {entry.label}
                </button>
              );
            }

            const isOpen = openGroup === entry.id;
            const hasActiveChild = entry.items.some((i) => i.id === module);
            return (
              <div key={entry.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.id)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
                    hasActiveChild
                      ? "text-accent"
                      : "text-ink/75 hover:bg-linen-hover hover:text-ink"
                  }`}
                >
                  <ChevronRightIcon
                    className={`size-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="flex-1 truncate text-left">
                    {entry.label}
                  </span>
                </button>
                {isOpen && (
                  <div className="ml-3.5 flex flex-col gap-0.5 border-l border-linen py-0.5 pl-2.5">
                    {entry.items.map((item) => {
                      const active = module === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => onModuleChange(item.id)}
                          className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
                            active
                              ? "bg-accent-soft text-accent"
                              : "text-ink/75 hover:bg-linen-hover hover:text-ink"
                          }`}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                          )}
                          <item.Icon className="size-4 shrink-0" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {module === "files" ? (
          <div className="flex-1" />
        ) : module === "chat" ? (
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            {!activeContentId ? (
              <p className="px-3 text-xs text-stone">
                Pick or create a content from the main panel.
              </p>
            ) : (
              <>
                <div className="mb-1 flex items-center justify-between px-3">
                  <span className="text-xs font-medium text-stone">
                    Chatting as
                  </span>
                  {creating !== "user" && (
                    <button
                      type="button"
                      onClick={() => setCreating("user")}
                      aria-label="Add user"
                      className="flex size-5 items-center justify-center rounded-full text-accent hover:bg-linen-hover"
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                  )}
                </div>
                {creating === "user" && createInput("User name")}

                {users.length === 0 ? (
                  <p className="px-3 text-xs text-stone">
                    Add a user above to start a conversation.
                  </p>
                ) : (
                  users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => onSelectUser(user.id)}
                      className={navClass(activeUserId === user.id)}
                    >
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-left">
                        {user.name}
                      </span>
                    </button>
                  ))
                )}
              </>
            )}
          </nav>
        ) : module === "teams" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Chat one-to-one or in groups, and create teams with channels. Teams
            are shared between accounts, whichever customer you are in.
          </div>
        ) : module === "notes" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Sticky notes for text, images, and links. Use "New note" above the
            grid, then the toolbar inside a note to add more blocks.
          </div>
        ) : module === "textChats" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Paste or upload a block of text to turn it into a scrollable chat —
            one bubble per sentence. Highlight, format, attach images/videos, or
            combine two conversations from the main panel.
          </div>
        ) : module === "bills" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Create and manage bills/quotations from the main panel. Export each
            as a PDF (print) or a photo (PNG) once it's filled in.
          </div>
        ) : module === "books" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Create books, add pages, and drag in text/images from the main
            panel. Switch to Read mode for a page-turn preview, or Export PDF
            for one PDF page per page.
          </div>
        ) : module === "tasks" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Add sections, then tasks inside them. Drag a task (or use its
            arrows) to move it to another section.
          </div>
        ) : module === "pdfs" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Upload PDFs into folders, same as Files. Open one to drag-select
            text and highlight it, or capture a snapshot of part of a page as a
            new image.
          </div>
        ) : module === "movies" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Create a movie, then add video/image clips from the main panel. Each
            clip gets its own animation, transitions, and dialogue bubbles —
            export re-records the whole timeline as a new video.
          </div>
        ) : module === "slideshows" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Pick a category's worth of images/videos (or add your own), choose a
            transition style and seconds-per-slide, then fine-tune timing, trim,
            and captions from the timeline that opens.
          </div>
        ) : module === "websites" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Create a site, add pages, then drag blocks from the palette onto the
            canvas to build header/hero/sections/footer. Export a page as a
            self-contained .zip once it's ready.
          </div>
        ) : module === "api" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Pick a method and URL, set headers/body, then Send. JSON responses
            get pretty-printed with a copy button; images/video/audio preview
            inline, and anything else downloads. Past requests are listed in the
            main panel's history.
          </div>
        ) : module === "customApis" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            Define a method, path, status code, and response body — it's live at
            a real public URL immediately, no login needed to call it. "Try it"
            tests the real thing before you rely on it elsewhere.
          </div>
        ) : module === "reports" ? (
          <div className="flex-1 px-3 text-xs text-stone">
            File report, Chat report, and other per-module reports live in the
            main panel's nav — everything's recalculated from the server on
            Refresh, nothing is saved here.
          </div>
        ) : (
          <div className="flex-1 px-3 text-xs text-stone">
            Pick a photo or video in the main panel to start customizing it.
            Edits are saved as new files — nothing here is overwritten.
          </div>
        )}

        {module === "files" && (
          <BackupToolbar
            onExport={onExportAll}
            onImport={onImportBackup}
            disabled={categories.length === 0}
          />
        )}

        <div className="mt-3 border-t border-linen pt-3">
          <p className="truncate px-2 text-[11px] font-medium uppercase tracking-wide text-stone">
            {customerName}
          </p>
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={onLeaveCustomer}
              className="flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs font-medium text-ink/75 transition-colors hover:bg-linen-hover hover:text-ink"
            >
              Switch customer
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md px-2 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:bg-linen-hover hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
