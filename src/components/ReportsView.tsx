import { useState } from "react";
import type { ReportSummary } from "@/types/report";
import { formatBytes } from "@/lib/formatBytes";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ReportStatCard } from "@/components/ReportStatCard";
import { ChartIcon, RotateIcon, SpinnerIcon } from "@/components/icons";

type Props = {
  summary: ReportSummary | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

type OtherReportKey =
  | "notes"
  | "bills"
  | "books"
  | "tasks"
  | "movies"
  | "websites"
  | "pdfHighlights"
  | "textChats";

type ReportKey = "file" | "chat" | OtherReportKey;

const OTHER_REPORTS: { key: OtherReportKey; label: string }[] = [
  { key: "notes", label: "Notes" },
  { key: "bills", label: "Bills" },
  { key: "books", label: "Books" },
  { key: "tasks", label: "Tasks" },
  { key: "movies", label: "Movies" },
  { key: "websites", label: "Websites" },
  { key: "pdfHighlights", label: "PDF highlights" },
  { key: "textChats", label: "Text Chat" },
];

const navButton = (active: boolean) =>
  `flex w-full items-center rounded-md px-3 py-2 text-left text-[13.5px] font-medium transition-colors ${
    active
      ? "bg-accent-soft text-accent"
      : "text-ink/75 hover:bg-linen-hover hover:text-ink"
  }`;

const table = "w-full overflow-hidden rounded-lg border border-linen text-sm";
const th = "bg-linen/50 px-3 py-2 text-left text-xs font-medium text-stone";
const td = "border-t border-linen px-3 py-2 text-ink";

/** Reports module — a left nav (File/Chat flat, everything else tucked behind a collapsible
 * "Other reports" group) and a right-hand panel of stat tiles/tables for whichever report is
 * selected. Every number comes from GET /api/reports/summary, recalculated server-side from
 * `db` on each load — nothing here is client state of its own. */
export function ReportsView({ summary, loading, error, onRefresh }: Props) {
  const [selected, setSelected] = useState<ReportKey>("file");

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <ChartIcon className="size-4 text-stone" />
          <h1 className="text-base font-medium text-ink">Reports</h1>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-linen px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-linen-hover disabled:opacity-50"
        >
          {loading ? (
            <SpinnerIcon className="size-3.5 animate-spin" />
          ) : (
            <RotateIcon className="size-3.5" />
          )}
          Refresh
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav className="max-h-56 w-full shrink-0 space-y-1 overflow-y-auto border-b border-linen bg-white px-3 py-4 sm:max-h-none sm:w-56 sm:border-b-0 sm:border-r">
          <button
            type="button"
            onClick={() => setSelected("file")}
            className={navButton(selected === "file")}
          >
            File report
          </button>
          <button
            type="button"
            onClick={() => setSelected("chat")}
            className={navButton(selected === "chat")}
          >
            Chat report
          </button>
          <div className="pt-1">
            <CollapsibleSection
              title="Other reports"
              defaultOpen={OTHER_REPORTS.some((r) => r.key === selected)}
            >
              <div className="space-y-0.5 p-1.5">
                {OTHER_REPORTS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className={navButton(selected === key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
          {error && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {!summary ? (
            <p className="text-sm text-stone">
              {loading ? "Calculating…" : "No data yet."}
            </p>
          ) : selected === "file" ? (
            <FileReport summary={summary} />
          ) : selected === "chat" ? (
            <ChatReport summary={summary} />
          ) : (
            <OtherReport reportKey={selected} summary={summary} />
          )}
        </div>
      </div>
    </div>
  );
}

function FileReport({ summary }: { summary: ReportSummary }) {
  const { storage } = summary;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">
          Storage (uploaded files only — bundled stock assets aren't counted)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReportStatCard label="Files" value={storage.totalCount} />
          <ReportStatCard
            label="Total size"
            value={formatBytes(storage.totalBytes)}
          />
          <ReportStatCard
            label="Images"
            value={storage.byType.image.count}
            hint={formatBytes(storage.byType.image.bytes)}
          />
          <ReportStatCard
            label="Videos"
            value={storage.byType.video.count}
            hint={formatBytes(storage.byType.video.bytes)}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">By category</h2>
        {storage.byCategory.length === 0 ? (
          <p className="text-sm text-stone">No uploaded files yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Category</th>
                  <th className={th}>Files</th>
                  <th className={th}>Size</th>
                </tr>
              </thead>
              <tbody>
                {storage.byCategory.map((row) => (
                  <tr key={row.category}>
                    <td className={td}>{row.category}</td>
                    <td className={td}>{row.count}</td>
                    <td className={td}>{formatBytes(row.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Largest files</h2>
        {storage.largestFiles.length === 0 ? (
          <p className="text-sm text-stone">No uploaded files yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Category</th>
                  <th className={th}>Type</th>
                  <th className={th}>Size</th>
                </tr>
              </thead>
              <tbody>
                {storage.largestFiles.map((file) => (
                  <tr key={file.id}>
                    <td className={td}>{file.title}</td>
                    <td className={td}>{file.category}</td>
                    <td className={td}>{file.type}</td>
                    <td className={td}>{formatBytes(file.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatReport({ summary }: { summary: ReportSummary }) {
  const { chat } = summary;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStatCard label="Conversations" value={chat.contents} />
        <ReportStatCard label="Users" value={chat.users} />
        <ReportStatCard label="Messages" value={chat.messages} />
        <ReportStatCard label="Attachments" value={chat.attachments} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">By conversation</h2>
        {chat.byContent.length === 0 ? (
          <p className="text-sm text-stone">No conversations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Content</th>
                  <th className={th}>Users</th>
                  <th className={th}>Messages</th>
                  <th className={th}>Attachments</th>
                </tr>
              </thead>
              <tbody>
                {chat.byContent.map((row) => (
                  <tr key={row.contentId}>
                    <td className={td}>{row.name}</td>
                    <td className={td}>{row.users}</td>
                    <td className={td}>{row.messages}</td>
                    <td className={td}>{row.attachments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function OtherReport({
  reportKey,
  summary,
}: {
  reportKey: OtherReportKey;
  summary: ReportSummary;
}) {
  if (reportKey === "notes") {
    const { notes } = summary;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard label="Notes" value={notes.count} />
        <ReportStatCard label="Pinned" value={notes.pinned} />
        <ReportStatCard label="Blocks" value={notes.blocks} />
      </div>
    );
  }
  if (reportKey === "bills") {
    const { bills } = summary;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard label="Bills / quotations" value={bills.count} />
        <ReportStatCard label="Line items" value={bills.items} />
      </div>
    );
  }
  if (reportKey === "books") {
    const { books } = summary;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard label="Books" value={books.count} />
        <ReportStatCard label="Pages" value={books.pages} />
      </div>
    );
  }
  if (reportKey === "tasks") {
    const { tasks } = summary;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard label="Sections" value={tasks.sections} />
        <ReportStatCard label="Tasks" value={tasks.tasks} />
        <ReportStatCard label="Completed" value={tasks.completed} />
      </div>
    );
  }
  if (reportKey === "movies") {
    const { movies } = summary;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard label="Movies" value={movies.count} />
        <ReportStatCard label="Clips" value={movies.clips} />
      </div>
    );
  }
  if (reportKey === "websites") {
    const { websites } = summary;
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard label="Sites" value={websites.count} />
        <ReportStatCard label="Pages" value={websites.pages} />
      </div>
    );
  }
  if (reportKey === "pdfHighlights") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStatCard
          label="Highlights"
          value={summary.pdfHighlights.count}
        />
      </div>
    );
  }
  const { textChats } = summary;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <ReportStatCard label="Conversations" value={textChats.conversations} />
      <ReportStatCard label="Sentences" value={textChats.messages} />
      <ReportStatCard label="Attachments" value={textChats.attachments} />
      <ReportStatCard label="Highlighted" value={textChats.highlighted} />
    </div>
  );
}
