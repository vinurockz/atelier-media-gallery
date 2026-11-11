/** One mirror of server/index.mjs's GET /api/reports/summary — everything here is
 * computed server-side from `db` on request, not stored, so this is a read model only. */
export interface TypeBreakdown {
  count: number;
  bytes: number;
}

export interface CategoryStorage {
  category: string;
  count: number;
  bytes: number;
}

export interface LargestFile {
  id: string;
  title: string;
  category: string;
  type: "image" | "video" | "pdf";
  bytes: number;
}

export interface ChatContentStat {
  contentId: string;
  name: string;
  messages: number;
  users: number;
  attachments: number;
}

export interface ReportSummary {
  generatedAt: number;
  storage: {
    totalCount: number;
    totalBytes: number;
    byType: Record<"image" | "video" | "pdf", TypeBreakdown>;
    byCategory: CategoryStorage[];
    largestFiles: LargestFile[];
  };
  chat: {
    contents: number;
    users: number;
    messages: number;
    attachments: number;
    byContent: ChatContentStat[];
  };
  notes: { count: number; pinned: number; blocks: number };
  bills: { count: number; items: number };
  books: { count: number; pages: number };
  tasks: { sections: number; tasks: number; completed: number };
  movies: { count: number; clips: number };
  websites: { count: number; pages: number };
  pdfHighlights: { count: number };
  textChats: {
    conversations: number;
    messages: number;
    attachments: number;
    highlighted: number;
  };
}
