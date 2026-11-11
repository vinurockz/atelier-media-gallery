import type { ComponentType, SVGProps } from "react";
import DOMPurify from "dompurify";
import type {
  Block,
  BlockKind,
  Column,
  Section,
  SitePage,
  SocialLink,
} from "@/types/website";
import {
  ArrowRightIcon,
  BoldIcon,
  CheckIcon,
  CircleShapeIcon,
  CodeIcon,
  FacebookIcon,
  FilmIcon,
  GlobeIcon,
  GridIcon,
  ImageIcon,
  InstagramIcon,
  LineShapeIcon,
  LinkedinIcon,
  ListIcon,
  MailIcon,
  PinIcon,
  RectShapeIcon,
  ReceiptIcon,
  SpinnerIcon,
  StarIcon,
  TaskBoardIcon,
  TextIcon,
  TiktokIcon,
  TwitterIcon,
  YoutubeIcon,
} from "@/components/icons";

export function makeId(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

function emptyColumn(widthFraction: number): Column {
  return { id: makeId("col"), widthFraction, blocks: [] };
}

/** A new, empty section with one full-width column — the starting point when a user
 * adds a section to a page, before they split it into more columns via a `columns`
 * block nested inside. */
export function createEmptySection(index: number): Section {
  return { id: makeId("section"), index, columns: [emptyColumn(1)] };
}

/**
 * Pure tree-mutation helpers for top-level blocks (a section's column's direct
 * blocks) — the only level the canvas's drag system addresses. A `columns`/`tabs`
 * block's own nested sub-blocks are edited by replacing that whole block (via
 * `updateBlockInSections`) with a new object built from its own simplified
 * add/remove list editor in BlockStylePanel.tsx, not through these.
 */
export function insertBlockIntoSections(
  sections: Section[],
  sectionId: string,
  columnId: string,
  index: number,
  block: Block,
): Section[] {
  return sections.map((s) =>
    s.id !== sectionId
      ? s
      : {
          ...s,
          columns: s.columns.map((c) =>
            c.id !== columnId
              ? c
              : {
                  ...c,
                  blocks: [
                    ...c.blocks.slice(0, index),
                    block,
                    ...c.blocks.slice(index),
                  ],
                },
          ),
        },
  );
}

export function removeBlockFromSections(
  sections: Section[],
  sectionId: string,
  columnId: string,
  blockId: string,
): Section[] {
  return sections.map((s) =>
    s.id !== sectionId
      ? s
      : {
          ...s,
          columns: s.columns.map((c) =>
            c.id !== columnId
              ? c
              : { ...c, blocks: c.blocks.filter((b) => b.id !== blockId) },
          ),
        },
  );
}

export function moveBlockInSections(
  sections: Section[],
  from: { sectionId: string; columnId: string; blockId: string },
  to: { sectionId: string; columnId: string; index: number },
): Section[] {
  let moved: Block | null = null;
  const withoutMoved = sections.map((s) =>
    s.id !== from.sectionId
      ? s
      : {
          ...s,
          columns: s.columns.map((c) => {
            if (c.id !== from.columnId) return c;
            const found = c.blocks.find((b) => b.id === from.blockId);
            if (found) moved = found;
            return {
              ...c,
              blocks: c.blocks.filter((b) => b.id !== from.blockId),
            };
          }),
        },
  );
  if (!moved) return sections;
  const movedBlock: Block = moved;
  return withoutMoved.map((s) =>
    s.id !== to.sectionId
      ? s
      : {
          ...s,
          columns: s.columns.map((c) =>
            c.id !== to.columnId
              ? c
              : {
                  ...c,
                  blocks: [
                    ...c.blocks.slice(0, to.index),
                    movedBlock,
                    ...c.blocks.slice(to.index),
                  ],
                },
          ),
        },
  );
}

export function updateBlockInSections(
  sections: Section[],
  sectionId: string,
  columnId: string,
  blockId: string,
  next: Block,
): Section[] {
  return sections.map((s) =>
    s.id !== sectionId
      ? s
      : {
          ...s,
          columns: s.columns.map((c) =>
            c.id !== columnId
              ? c
              : {
                  ...c,
                  blocks: c.blocks.map((b) => (b.id === blockId ? next : b)),
                },
          ),
        },
  );
}

export function updateColumnInSections(
  sections: Section[],
  sectionId: string,
  columnId: string,
  patch: Partial<Column>,
): Section[] {
  return sections.map((s) =>
    s.id !== sectionId
      ? s
      : {
          ...s,
          columns: s.columns.map((c) =>
            c.id !== columnId ? c : { ...c, ...patch },
          ),
        },
  );
}

export function updateSectionInSections(
  sections: Section[],
  sectionId: string,
  patch: Partial<Section>,
): Section[] {
  return sections.map((s) => (s.id !== sectionId ? s : { ...s, ...patch }));
}

export function removeSectionFromSections(
  sections: Section[],
  sectionId: string,
): Section[] {
  return sections
    .filter((s) => s.id !== sectionId)
    .map((s, i) => ({ ...s, index: i }));
}

/** Walks a block tree (including nested `columns`/`tabs` sub-blocks) and collects every
 * referenced MediaItem id — used by siteExport.ts to know which files to localize into
 * the exported zip's assets/ folder. */
function collectMediaIdsFromBlock(block: Block, into: Set<string>): void {
  switch (block.kind) {
    case "header":
      if (block.logoMediaId) into.add(block.logoMediaId);
      break;
    case "hero":
      if (block.backgroundMediaId) into.add(block.backgroundMediaId);
      break;
    case "image":
      if (block.mediaId) into.add(block.mediaId);
      break;
    case "gallery":
      block.mediaIds.forEach((id) => into.add(id));
      break;
    case "video":
      if (block.mediaId) into.add(block.mediaId);
      break;
    case "testimonial":
      if (block.authorAvatarMediaId) into.add(block.authorAvatarMediaId);
      break;
    case "team":
      block.members.forEach((m) => {
        if (m.photoMediaId) into.add(m.photoMediaId);
      });
      break;
    case "columns":
      block.columns.forEach((c) =>
        c.blocks.forEach((b) => collectMediaIdsFromBlock(b, into)),
      );
      break;
    case "tabs":
      block.tabs.forEach((t) =>
        t.blocks.forEach((b) => collectMediaIdsFromBlock(b, into)),
      );
      break;
    default:
      break;
  }
}

export function collectMediaIdsFromPage(page: SitePage): Set<string> {
  const ids = new Set<string>();
  if (page.header) collectMediaIdsFromBlock(page.header, ids);
  if (page.hero) collectMediaIdsFromBlock(page.hero, ids);
  if (page.footer) collectMediaIdsFromBlock(page.footer, ids);
  for (const section of page.sections) {
    for (const column of section.columns) {
      for (const block of column.blocks) collectMediaIdsFromBlock(block, ids);
    }
  }
  return ids;
}

/** Sensible starting content for a freshly-added block of each kind, so the canvas
 * never shows a totally empty/invisible block right after adding it. */
export function createDefaultBlock(kind: BlockKind): Block {
  const id = makeId("block");
  switch (kind) {
    case "header":
      return { id, kind, navItems: [], sticky: true };
    case "hero":
      return {
        id,
        kind,
        heading: "Your headline here",
        subheading: "A short supporting sentence goes here.",
        ctaLabel: "Get started",
        align: "center",
      };
    case "footer":
      return {
        id,
        kind,
        text: `© ${new Date().getFullYear()} Your company`,
        navItems: [],
      };
    case "columns":
      return { id, kind, columns: [emptyColumn(0.5), emptyColumn(0.5)] };
    case "spacerDivider":
      return { id, kind, variant: "spacer", height: 40 };
    case "richText":
      return { id, kind, html: "<p>Write something…</p>" };
    case "heading":
      return { id, kind, text: "Heading", level: 2 };
    case "image":
      return { id, kind, mediaId: null, alt: "" };
    case "gallery":
      return { id, kind, mediaIds: [], layout: "grid", columns: 3 };
    case "video":
      return { id, kind, mediaId: null, controls: true };
    case "button":
      return { id, kind, label: "Click me", variant: "solid" };
    case "icon":
      return { id, kind, iconName: "star", size: 32 };
    case "iconList":
      return {
        id,
        kind,
        items: [
          { iconName: "star", title: "Feature one", description: "" },
          { iconName: "check", title: "Feature two", description: "" },
        ],
        columns: 3,
      };
    case "testimonial":
      return {
        id,
        kind,
        quote: "This made things so much easier for us.",
        authorName: "Happy customer",
      };
    case "pricingTable":
      return {
        id,
        kind,
        plans: [
          {
            name: "Basic",
            price: "$9",
            period: "/mo",
            features: ["One feature"],
          },
          {
            name: "Pro",
            price: "$29",
            period: "/mo",
            features: ["Everything in Basic"],
            highlighted: true,
          },
        ],
      };
    case "faq":
      return {
        id,
        kind,
        items: [
          { question: "A question goes here?", answer: "And its answer." },
        ],
      };
    case "team":
      return {
        id,
        kind,
        members: [{ name: "Team member", role: "Role" }],
        columns: 3,
      };
    case "stats":
      return { id, kind, items: [{ value: "100+", label: "Happy customers" }] };
    case "socialLinks":
      return { id, kind, links: [] };
    case "map":
      return { id, kind, address: "" };
    case "form":
      return {
        id,
        kind,
        fields: [
          { id: makeId("field"), label: "Name", type: "text", required: true },
          {
            id: makeId("field"),
            label: "Email",
            type: "email",
            required: true,
          },
          { id: makeId("field"), label: "Message", type: "textarea" },
        ],
        submitLabel: "Send",
      };
    case "countdown":
      return {
        id,
        kind,
        targetDate: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      };
    case "tabs":
      return {
        id,
        kind,
        tabs: [
          { label: "Tab 1", blocks: [] },
          { label: "Tab 2", blocks: [] },
        ],
      };
    case "customHtml":
      return { id, kind, html: "<p>Hello world</p>", css: "", height: 300 };
  }
}

export interface PaletteEntry {
  kind: BlockKind;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  group: "Structure" | "Content" | "Showcase" | "Interactive";
}

/** Metadata for the ~22-block palette panel. "Columns" is itself a block (a nested
 * row/column grid), not the section mechanism — see src/types/website.ts's comment. */
export const BLOCK_PALETTE: PaletteEntry[] = [
  { kind: "header", label: "Header", icon: ListIcon, group: "Structure" },
  { kind: "hero", label: "Hero", icon: ImageIcon, group: "Structure" },
  { kind: "footer", label: "Footer", icon: GridIcon, group: "Structure" },
  { kind: "columns", label: "Columns", icon: GridIcon, group: "Structure" },
  {
    kind: "spacerDivider",
    label: "Spacer / Divider",
    icon: LineShapeIcon,
    group: "Structure",
  },

  { kind: "richText", label: "Rich text", icon: TextIcon, group: "Content" },
  { kind: "heading", label: "Heading", icon: BoldIcon, group: "Content" },
  { kind: "image", label: "Image", icon: ImageIcon, group: "Content" },
  { kind: "gallery", label: "Gallery", icon: ImageIcon, group: "Content" },
  { kind: "video", label: "Video", icon: FilmIcon, group: "Content" },
  { kind: "button", label: "Button", icon: RectShapeIcon, group: "Content" },
  { kind: "icon", label: "Icon", icon: StarIcon, group: "Content" },

  { kind: "iconList", label: "Icon list", icon: ListIcon, group: "Showcase" },
  {
    kind: "testimonial",
    label: "Testimonial",
    icon: CircleShapeIcon,
    group: "Showcase",
  },
  {
    kind: "pricingTable",
    label: "Pricing table",
    icon: ReceiptIcon,
    group: "Showcase",
  },
  { kind: "faq", label: "FAQ", icon: CheckIcon, group: "Showcase" },
  { kind: "team", label: "Team", icon: CircleShapeIcon, group: "Showcase" },
  { kind: "stats", label: "Stats", icon: TaskBoardIcon, group: "Showcase" },
  {
    kind: "socialLinks",
    label: "Social links",
    icon: GlobeIcon,
    group: "Showcase",
  },

  { kind: "map", label: "Map", icon: PinIcon, group: "Interactive" },
  { kind: "form", label: "Contact form", icon: MailIcon, group: "Interactive" },
  {
    kind: "countdown",
    label: "Countdown",
    icon: SpinnerIcon,
    group: "Interactive",
  },
  { kind: "tabs", label: "Tabs", icon: GridIcon, group: "Interactive" },
  {
    kind: "customHtml",
    label: "Custom HTML/CSS",
    icon: CodeIcon,
    group: "Interactive",
  },
];

/** Icon choices offered for the `icon`/`iconList` blocks' `iconName` field, and reused
 * by `socialLinks`/`team` where relevant. Keys are the strings stored in block data —
 * stable identifiers, not display labels, so renaming a label never breaks saved data. */
export const BUILDER_ICONS: Record<
  string,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  star: StarIcon,
  check: CheckIcon,
  arrow: ArrowRightIcon,
  globe: GlobeIcon,
  pin: PinIcon,
  mail: MailIcon,
};

export const BUILDER_ICON_NAMES = Object.keys(BUILDER_ICONS);

/** Preset color swatches for block-style color pickers, following the same
 * Record<key,hex> + ordered-array shape as src/lib/noteColor.ts. Each picker still ends
 * with a CustomColorSwatch for "any color" — these are just the quick presets. */
export const BLOCK_BG_SWATCHES: Record<string, string> = {
  white: "#ffffff",
  surface: "#f8f9fa",
  dark: "#111827",
  blue: "#1a73e8",
  green: "#16a34a",
  amber: "#d97706",
};
export const BLOCK_BG_ORDER = [
  "white",
  "surface",
  "dark",
  "blue",
  "green",
  "amber",
];

export const BLOCK_TEXT_SWATCHES: Record<string, string> = {
  dark: "#111827",
  muted: "#5f6368",
  white: "#ffffff",
  blue: "#1a73e8",
};
export const BLOCK_TEXT_ORDER = ["dark", "muted", "white", "blue"];

export const SOCIAL_ICON_BY_PLATFORM: Record<
  SocialLink["platform"],
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  twitter: TwitterIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  other: GlobeIcon,
};

export const SOCIAL_PLATFORMS: SocialLink["platform"][] = [
  "twitter",
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "other",
];

/** A slightly larger allowlist than Notes' NoteTextBlock (which permits no attributes
 * or headings at all) since a website's rich-text block reasonably wants headings and
 * links — still no `<script>`/`style=`/event-handler attributes. Applied both when the
 * contentEditable editor saves (defense in depth) and again right before every render,
 * same two-sided convention NoteTextBlock already established. */
const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "span",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
];

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

/** Vanilla-JS tick loop for the `countdown` block's exported/previewed HTML. Only
 * executes inside a fresh-document-parse context (an iframe's `srcDoc`, or the final
 * exported static file) — a dynamically inserted `<script>` never auto-executes when
 * React renders it directly into the app's own live DOM (the bare editor canvas), so
 * the countdown shows a static "--" there and ticks for real in Preview/export. */
export function countdownScript(containerId: string): string {
  return `(function(){
    var el = document.getElementById(${JSON.stringify(containerId)});
    if (!el) return;
    var target = new Date(el.getAttribute("data-target")).getTime();
    function tick(){
      var diff = Math.max(0, target - Date.now());
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      var days = el.querySelector(".cd-days");
      var hours = el.querySelector(".cd-hours");
      var mins = el.querySelector(".cd-mins");
      var secs = el.querySelector(".cd-secs");
      if (days) days.textContent = String(d);
      if (hours) hours.textContent = String(h).padStart(2, "0");
      if (mins) mins.textContent = String(m).padStart(2, "0");
      if (secs) secs.textContent = String(s).padStart(2, "0");
    }
    tick();
    setInterval(tick, 1000);
  })();`;
}
