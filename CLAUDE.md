# CLAUDE.md

Guidance for Claude Code when working in this React single-page website.

## Stack

- React 19, Vite 6 (SWC plugin), TypeScript 5 in `strict` mode
- React Router 7 for routing, with route loaders and actions
- TanStack Query 5 for all server data
- Zustand only for client-only global state that Context can't handle cleanly
- Tailwind CSS 4 for styling, with a `cn()` helper for conditional classes
- React Hook Form + Zod for forms and validation
- Vitest + React Testing Library + MSW for tests; Playwright for E2E
- ESLint 9, Prettier, pnpm

If a version here doesn't match `package.json`, trust `package.json` and update this file.

## Commands

- Install: `pnpm install`
- Dev server: `pnpm dev`
- Build: `pnpm build`
- Preview build: `pnpm preview`
- Type check: `pnpm typecheck`
- Lint: `pnpm lint`
- Format: `pnpm format`
- Unit tests: `pnpm test`
- Coverage: `pnpm test:coverage`
- E2E: `pnpm test:e2e`

Before reporting a task as done, run `pnpm typecheck`, `pnpm lint`, and `pnpm test`.

## Project structure

```
src/
  app/            Router, providers, root error boundary
  features/       Feature folders (e.g. features/checkout/) with their own components, hooks, api, tests
  components/     Shared UI used by 2+ features
    ui/           Primitives (Button, Input, Card)
  pages/          Route components; thin, compose features
  lib/            Non-React utilities, API client (lib/api/), cn()
  hooks/          Shared hooks
  types/          Shared types
  styles/         Global CSS and Tailwind entry
public/           Static assets
```

- Features must not import from each other. Shared code moves to `components/`, `hooks/`, or `lib/`.
- No barrel `index.ts` re-exports. Import from the file that defines the thing.
- Colocate tests next to the file they test (`Button.tsx` and `Button.test.tsx`).

## TypeScript and components

- Function components only. Don't use `React.FC`.
- No `any`, no `@ts-ignore`. Use `unknown` and narrow it. Use discriminated unions and exhaustive `switch` checks.
- Named exports only. Exception: route components if the router requires a default export.
- Props are typed with an explicit `type Props = {...}` next to the component.
- One component per file. Keep components focused; extract a hook when data logic and rendering are mixed.
- Prefer composition and `children` over configuration props.
- Use stable keys (IDs from data), never array indexes for dynamic lists.
- Don't store derived values in state. Compute them during render.
- Memoize (`memo`, `useMemo`, `useCallback`) only when profiling shows a problem.

## State and hooks

- Choose state in this order: local `useState` → lifted state → Context → Zustand. Server data always goes in TanStack Query, never copied into state.
- `useEffect` is only for syncing with external systems (subscriptions, DOM APIs, timers). Never use it for data fetching or to derive state. Always clean up subscriptions and timers.
- Guard async effects against stale results and unmounted components.

## Data fetching

- Fetch only through TanStack Query hooks or React Router loaders. Components never call `fetch` directly; all HTTP goes through `src/lib/api/`.
- Define query keys with a factory per feature (e.g. `checkoutKeys.cart(id)`).
- Set `staleTime` explicitly per query.
- Invalidate related queries in mutation `onSuccess`. Use optimistic updates only when the UX needs them.
- Every async view handles loading, empty, and error states.
- Validate API responses with Zod at the boundary before they reach components.

## Routing and code splitting

- Lazy-load every route with `React.lazy` and `Suspense`.
- Set an `errorElement` on every route.
- Navigate with `<Link>` or `useNavigate()`. Don't use `window.location.href` for in-app navigation.

## Error handling

- A root error boundary wraps the app; feature-level boundaries wrap large sections.
- Show toast notifications for failed mutations.
- The API client handles 401/403 (redirect or re-auth), 429 (retry with backoff), and 500+ (generic error message).
- Never swallow errors silently. Log or surface every caught error.

## Styling and accessibility

- Tailwind utilities only. Use `cn()` for conditional classes. Extract repeated class groups into `components/ui/`.
- Design tokens (colors, spacing, fonts, breakpoints) live in the Tailwind theme. No hardcoded hex values in components.
- Mobile-first. Check layouts at mobile, tablet, and desktop widths.
- Use semantic HTML and one `<h1>` per page. Every image has `alt` text, or `alt=""` if decorative.
- Every interactive element is keyboard reachable with a visible focus style.
- Respect `prefers-reduced-motion`. Meet WCAG 2.1 AA contrast.
- Use headless accessible primitives for complex widgets (dialogs, menus, comboboxes). Keep `eslint-plugin-jsx-a11y` enabled.

## SEO

- Every page sets its own `<title>` and meta description through a shared `Seo` component.
- Provide Open Graph tags for shareable pages.

## Performance

- Set explicit `width` and `height` on images; use WebP/AVIF and `loading="lazy"` below the fold.
- Import single functions, not whole libraries.
- Keep bundle size within budget. Investigate any chunk warning rather than raising the limit.

## Environment and security

- Only `VITE_`-prefixed variables reach the client. Never put secrets in them.
- No hardcoded API URLs; read them from env. Commit `.env.example` with placeholders only. Never commit `.env*` files with real values.
- No `process.env` in client code.
- Don't store auth tokens in `localStorage`. Use httpOnly cookies or in-memory state.
- Sanitize HTML with DOMPurify before any `dangerouslySetInnerHTML`. Prefer not to use it at all.
- Content Security Policy headers are set at the hosting layer.

## Testing

- Query by role and accessible name, not class names or test IDs, unless no better option exists.
- Test what the user sees and does, not implementation details. No snapshot tests.
- Mock HTTP with MSW, not by mocking hooks or modules.
- Every bug fix gets a regression test. New non-trivial logic gets tests in the same change.
- Coverage targets by directory: `features/` 80%, `lib/` 70%, `components/` 50%.
- E2E (Playwright) covers critical flows such as sign-in, checkout, and forms.

## Tooling and workflow

- Use pnpm. Don't edit lockfiles by hand; use `pnpm add` / `pnpm remove`.
- Don't add a dependency without a short reason. Check the existing stack first.
- Work on a feature branch; don't commit directly to `main`.
- Conventional commit messages: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`.
- Prettier formats on save and in pre-commit hooks (Husky + lint-staged). Don't fight the formatter.
- Don't add ESLint or TypeScript suppressions without a comment explaining why.
- Don't leave `console.log` in committed code.

## Deployment

- `pnpm build` outputs static files to `dist/`.
- The host must serve `index.html` for unknown routes (SPA fallback).
- Cache hashed assets for a long time; never cache `index.html`.
- CI runs lint, typecheck, and tests before deploy.

## Working in this repo

1. Read the relevant existing files first and match their patterns.
2. Make the smallest change that solves the request. Don't rewrite unrelated files; mention them instead.
3. Run typecheck, lint, and tests.
4. Summarize what changed, and call out anything unverified or left undone.

## Project-specific overrides

- (Add project-specific rules here as they come up, such as brand guidelines, API contracts, or hosting details.)

### Media storage

Every `MediaItem` (photo/video/PDF, uploaded or produced by the Editor/Movies module) is
served through the backend, not kept in the browser. `server/mediaStorage.mjs` writes each
upload to `server/data/uploads/` under a random on-disk filename, and `db.media` (in
`server/db.mjs`) holds just the metadata record (`id`, `type`, `title`, `category`,
`filename`, `mimeType`, `size`, `createdAt`) — same "bytes on disk, scalars/ids in
`db.json`" split every other collection already uses. Routes: `GET/POST /api/media`,
`GET /api/media/:id/file` (streams the bytes — `res.sendFile` handles `Range` requests for
video scrubbing on its own), `DELETE /api/media/:id`. `src/lib/api/media.ts` is the client;
`src/hooks/useImportedMedia.ts` is the single place every module's uploads/imports/edited
exports flow through, building each `MediaItem.src` as `` `/api/media/${id}/file` ``.
Bundled stock assets (`src/assets/images|videos/*`, via `src/lib/media.ts`) are the one
exception — they're shipped in the JS bundle at build time, not user content, so they stay
bundled rather than uploaded.

`src/lib/importedMediaDb.ts` (an IndexedDB wrapper) predates this and is now legacy — kept
only so `src/lib/migrateImportedMedia.ts`'s one-time migration can read out anything a
browser still has left over from before file storage moved server-side, upload it, and
clear it. Don't add new calls into `importedMediaDb.ts`; new code goes through
`lib/api/media.ts` instead.

### Editor module ("troll editor")

The app has three sidebar modules: Files, Chat, and Editor (`src/components/EditorView.tsx`,
`ImageEditor.tsx`, `VideoEditor.tsx`). The Editor is a meme/"troll" style photo and video
customizer — no exact app named "Troll Editor" exists; it's modeled on the common pattern shared
by troll/meme-sticker apps (Photo Troller, Troll Face Camera, Troll Face & Meme Sticker): preset
sticker/emoji overlays plus bold outlined captions layered onto a photo or video.

No canonical "CLAUDE.md for an image/video editor" exists publicly either (checked before this
round's expansion too) — the toolset below is built from general Photoshop-style editor
conventions plus one concrete pattern confirmed in a real project (Polotno): **crop as
non-destructive metadata**, not baked pixels, so it composes cleanly with rotate/flip/filters and
stays undoable. That's the model this editor follows — see `ImageDoc`/`CropRect` in
`src/types/editor.ts`.

Current toolset — extend here, don't replace, when adding more:

- **Photo**: draggable top/bottom/free meme text (bold, outlined), speech bubbles with a tail,
  emoji stickers, rectangle/ellipse/line shapes, image layers (upload fresh, or "Select" an
  existing library photo via `AttachMediaModal` — see `addImages`/`addExistingImages` in
  `ImageEditor.tsx`), a freehand draw/doodle tool, Photoshop-style continuous adjustments
  (brightness, contrast, saturation, hue, grayscale, sepia, invert, blur, pixelate), a one-click
  sharpen, a non-destructive drag-to-select crop, 90°/180°/270° rotate + flip H/V, an eyedropper,
  per-layer opacity, zoom, header/footer bands (text, font family, bold/italic/uppercase, left/
  center/right align, fill/text/border color, border width, opacity) toggled from the left tree,
  a "Photo body" panel (corner radius, border, opacity) when Photo is selected, a canvas
  background color, and full undo/redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Y` or `+Shift+Z`).
- **Video**: trim to a start/end range, the same burned-in meme captions, the same adjustments
  panel, rotate/flip, crop margins (top/bottom/left/right %), playback speed (0.5×–2×), a mute
  toggle, and an emoji watermark.

**UI pattern**: every numeric control is a slider *paired with* a numeric input showing its unit
(px/%/°) — `src/components/SliderRow.tsx` — matching the reference admin-editor screenshots this
was modeled on (Shopify's theme editor: a label, a slider, and a boxed number+unit, every time).
Use `SliderRow` for any new numeric setting instead of a bare `<input type="range">`, even where
it feels like overkill for a one-off control — the whole point was consistency across every panel.

Conventions to keep:

- **Edits are always saved as a new file** (`onSave` in `EditorView.tsx`) — the source item in
  the file manager is never modified. Keep this invariant for any new tool.
- **No new heavy dependencies for media processing.** Video trim/export deliberately uses
  `canvas.captureStream()` + `MediaRecorder` instead of ffmpeg.wasm, to avoid a multi-megabyte
  WASM dependency for something the browser can already do. Prefer the same approach (canvas +
  native browser APIs) for new tools before reaching for a new package.
- **Shared drawing helpers live in `src/lib/memeText.ts`** (per-layer: text, speech bubble,
  sticker, shape) **and `src/lib/canvasDraw.ts`** (whole-canvas: Photoshop-style adjustments,
  sharpen, freehand strokes) — both editors call into these rather than duplicating canvas
  drawing code. The adjustments *slider UI* itself lives in `src/components/AdjustmentsPanel.tsx`,
  reused by both editors too. Add new layer/effect types in the `lib/` helpers, not inline in a
  component, so both editors can reuse them.
- **Crop is non-destructive** — it's a `CropRect` (0-1 relative to the current, already
  rotated/flipped view) stored in `ImageDoc`, not baked into pixels. Only `applySharpen` in
  `ImageEditor.tsx` bakes pixels (into a brand-new `image`, resetting rotation/flip/crop/
  adjustments to neutral since they're now part of it) — that's a deliberate exception because a
  convolution filter can't be expressed as a cheap per-frame redraw. Don't bake anything else
  without the same justification.
- **Undo/redo is one history snapshot per `ImageDoc` change** (`useHistory` in
  `src/hooks/useHistory.ts`), not per-pixel or per-keystroke — but it *is* per slider tick and per
  textarea keystroke, since batching those into one history entry per gesture would need
  additional focus/debounce tracking this project hasn't built yet. Live drag gestures (moving a
  layer, drawing a stroke, dragging a crop selection) are the exception: they're kept in local,
  non-historied state and only committed as a single history entry when the gesture ends
  (pointerup/Apply), so a drag doesn't flood undo with every intermediate frame. Follow that same
  split — local preview state during a drag, one `history.set` on release — for any new
  drag-based tool.

**Editor landing page** (`EditorView.tsx`, not editing anything yet): two blocks, "Images" and
"Videos" (`EditorSessionBlock.tsx`), each a history of edit **sessions** (`src/types/
editorSession.ts`, `src/hooks/useEditorSessions.ts`) — a session is `draft` from the moment you
pick a source item until you hit Save, then becomes `completed` and links to the new saved
`MediaItem`. Each tile is deletable (removes the history entry only, never the actual photo/
video/edited file). This tracks *which item you're editing*, not the edit itself — `ImageDoc`/
`VideoDoc` (layers, crop, adjustments) still live only in the open `ImageEditor`/`VideoEditor`'s
component state per the non-destructive/undo-history design above, so "resuming" a draft reopens
the editor fresh on that same source rather than restoring exact in-progress layer state; closing
without saving keeps the draft in history rather than discarding it. Sessions persist to
localStorage (`media-gallery:editor-sessions:v1`), not the `server/` backend — they're "what have
I been editing" activity referencing `MediaItem` ids the file manager already owns, not content of
their own, same reasoning as the active-chat-user-per-content map in `useChat.ts`.

### Notes module

A fourth sidebar module alongside Files/Chat/Editor: `src/components/NotesView.tsx`,
`NoteCard.tsx`, `NoteEditor.tsx`, `NoteTextBlock.tsx`. Modeled on Google Keep — a masonry grid
of colored sticky notes (pinned ones in their own section up top), each opening into a modal
editor. A note's body is a list of typed blocks (`src/types/notes.ts`), not a single text field,
so a note can mix text, images, and links freely:

- `{ type: "text", html }` — rich text (bold/italic/underline/bulleted list) via a small
  `contentEditable` + `document.execCommand` component, **not** a third-party rich-text editor —
  same "no new heavy dependency" reasoning as the Editor module's video pipeline. The one new
  dependency this module *did* add is `dompurify`, because CLAUDE.md's own security section
  requires it: text-block HTML is sanitized on every write (`NoteTextBlock`'s `sanitize()`) and
  again defensively right before every `dangerouslySetInnerHTML`-free render (it's rendered via
  the same sanitized-innerHTML path, never raw). Don't widen `ALLOWED_TAGS` without re-checking
  that reasoning.
- `{ type: "image", mediaItemId }` — references an existing file-manager `MediaItem` picked via
  the same `AttachMediaModal` chat/the editor already use. Notes never take a fresh file upload
  of their own; attach the photo/video to the library first (or pick one already there), same as
  chat attachments. Keeps note storage to small JSON, not duplicated blobs.
- `{ type: "link", url, label }` — a plain URL + display label, rendered as a card.

Backend: durable JSON storage in `server/` (`db.notes`, `GET/POST /api/notes`,
`PUT /api/notes/:id` for a partial patch, `DELETE /api/notes/:id`) — the same model as
contents/categories, **not** per-keystroke. `src/hooks/useNotes.ts` updates local state
immediately on every change but debounces the actual `PUT` ~600ms per note id (`patchNote`/
`flushNote`), so typing in a text block or dragging the color picker doesn't fire a request per
event. Call `flushNote(id)` when a note's editor closes so a change inside the debounce window
isn't lost. Follow the same immediate-local/debounced-remote split for any new note field.

**`Note.color` is a raw hex string**, not the `NoteColor` preset-key union (`"red"`,
`"default"`, ...) — that union/`NOTE_COLOR_SWATCHES` still exist purely as the preset-swatch
*lookup table*; picking a preset writes its resolved hex (`NOTE_COLOR_SWATCHES[key]`), and
`CustomColorSwatch` (shared by Notes/Books/the folder-color context menu — see below) can write
any hex. `server/db.mjs`'s `LEGACY_NOTE_COLOR_HEX` map upgrades any note still holding an old
key-based value on disk to its hex equivalent at load time.

### Bills module

A fifth sidebar module: `src/components/BillsView.tsx` (grid of saved bills/quotations),
`BillEditor.tsx` (form + live preview), `BillPreview.tsx` (the actual printable layout). Modeled
directly on a real handwritten letterhead bill from "Vrinda Aluminium Fabricators" the user
supplied as a reference image — see `src/types/bill.ts`'s `Bill` shape and the hardcoded sample
defaults in `server/index.mjs`'s `POST /api/bills` (company name/address/phone/footer prefilled
from that same reference, since they rarely change between bills).

Layout, matching the reference exactly: logo-or-styled-company-name top-left, address/phone
top-right, a divider, centered "BILL"/"QUOTATION" title, date, a "To," recipient block,
salutation + intro paragraph, then line items split **70% description / 30% amount** (`w-[70%]`/
`w-[30%]` in `BillPreview`), an auto-summed underlined total when there's more than one amount,
a right-aligned sign-off block (closing text + optional signature image + signer name), and a
footer line (the company's product/service list) under a top border.

- **Logo/signature are `AttachMediaModal` picks, like every other image reference in this app**
  — `companyLogoMediaItemId`/`signatureMediaItemId` on `Bill`, never a fresh standalone upload.
- **Export has no server-side PDF generation**, unlike Chat's `server/pdf.mjs`. A bill's logo/
  signature are `MediaItem`s served from the backend (`GET /api/media/:id/file`, see the
  "Media storage" section above) — the server can reach them, but both exports stay
  client-side anyway, for
  the same "no new dependency, browser already has what it needs" reasoning as everywhere else:
  - **"Export PDF"** is `window.print()` — `BillPreview`'s root has `className="print-area"`,
    and `src/styles/index.css`'s `@media print` block hides everything else in the document, so
    the browser's native print dialog (Save as PDF) renders just the bill. No new dependency.
  - **"Export photo"** draws the same content from scratch onto a `<canvas>`
    (`src/lib/billCanvas.ts`) and downloads it as a PNG — manual Canvas2D text layout/wrapping,
    not a DOM screenshot library (no html2canvas), same "canvas + native browser APIs over a new
    dependency" reasoning as the Editor module's video pipeline.
- **Edits save explicitly**, not autosaved like Notes — `BillEditor` holds its own draft state
  and only calls `onSave` (a `PUT /api/bills/:id` partial patch) when "Save" is clicked, since a
  half-filled bill mid-edit isn't meaningful to persist. Both exports always use the current
  draft, saved or not, so what you see in the preview is exactly what you get.

### Books module

A sixth sidebar module: `src/components/BooksView.tsx` (grid of books, `BookWorkspace.tsx`
(one open book: page rail + Edit/Read toggle + export), `BookPageCanvas.tsx` (the per-page
element editor), `BookReader.tsx` (flip-animated page viewer), `BookPrintPages.tsx` (PDF export).
See `src/types/book.ts`.

- **A book's pages are a separate backend collection** (`db.bookPages`), not nested inside the
  book record — same split as contents/users/messages, so fetching one book's pages never has to
  pull every other book's. `POST /api/books/:id/pages` 400s once `pageLimit` is hit;
  `DELETE .../pages/:pageId` renumbers the remaining pages' `index` server-side so page numbers
  stay contiguous — `useBookPages.removePage` refetches rather than reimplementing that
  renumbering client-side.
- **A page is a background color + a flat list of `BookElement`s** (text or image), each
  positioned with `x`/`y`/`width` as 0-1 fractions of the page box — same non-destructive,
  resolution-independent metadata idea as the Editor module's `CropRect`, so the identical layout
  renders correctly at canvas-editing size, reader size, and print size. `BookPageElements.tsx`
  is the single read-only renderer for all three (editor canvas, reader, print export) — add any
  new element type's rendering there, not in each consumer, so they can never visually disagree.
- **Dragging an element is local state until release** — `BookPageCanvas`'s `beginDrag` tracks
  the pointer in a local closure variable and only calls `onChangeElements` (one `PUT`) on
  `pointerup`, the same "local preview state during a drag, one commit on release" split the
  Editor module's layer dragging uses. Don't wire per-pointermove network calls into any new
  drag-based page tool.
- **No page-flip-book dependency.** `BookReader`'s turn animation is two stacked
  `BookPageElements` layers — the target page static underneath, the current page on top
  `rotateY`-ing away on its hinge with `backfaceVisibility: hidden` so it visually disappears
  mid-rotation and reveals the layer beneath. The top layer is `key`ed by page id so it remounts
  at rest (no transition) once the flip ends, instead of animating back from the flipped angle.
- **No PDF library either** — `BookPrintPages` renders every page full-size with
  `break-after: page` (`.book-print-page` in `src/styles/index.css`) inside the same
  `.print-area` class Bills' PDF export uses, so `window.print()` → Save as PDF turns out one PDF
  page per book page. Front/back cover are just the first/last page in the array, no special data
  shape — `BookWorkspace`'s page rail labels them "Cover"/"Back" purely as a UI nicety.
- **Resuming an edit always starts the open page fresh** — there's no separate "session" or
  undo history per page the way the Editor module has for a single photo; a page's `elements`
  array *is* its whole state, so leaving and reopening a book just reloads it from the server.
- **New fields are optional on `BookElement`** (`height`, `rotation`, `fontFamily`, `crop`,
  `shapeKind`, `fillColor`) because the `PUT /api/books/:id/pages/:pageId` route stores whatever
  element array the client sends with no server-side schema (same "opaque to the server" model as
  Notes' blocks) — old pages saved before a field existed just won't have it. Default with `??`
  at the point of use (see `BookPageElements.tsx`) rather than assuming it's present.
- **A third element type, `shape`** (`shapeKind: "rectangle" | "ellipse" | "line"`,
  `fillColor`), alongside text/image — same positioned-box model, just a filled div instead of
  text/an image.
- **Resize is a drag handle on the selected element's corner** (`BookPageCanvas`'s
  `beginResize`), not a stepper — same local-state-during-the-gesture, one-commit-on-release
  pattern as moving an element. It sets both `width` and `height`, so a text element gets a
  `height` the first time it's resized (previously text had no `height` at all and sized purely
  from its content).
- **Crop is non-destructive**, like the Editor module's `CropRect` — `BookElement.crop` is 0-1
  fractions of the *natural* image, edited in `BookImageCropModal.tsx` (drag to move, drag the
  corner dot to resize) against the full uncropped image, and rendered via an oversized,
  positioned `<img>` inside an `overflow: hidden` box (`BookPageElements.tsx`) — no canvas baking,
  so it stays editable. Replacing an image clears its `crop` (an old crop rect wouldn't mean
  anything against a different photo).
- **Rotation** is a ±15°-per-click stepper in the side panel, applied as `transform: rotate()`
  on the element's box — works the same for text, image, and shape.
- **Images can come from the library or straight from disk** — `BookPageCanvas`'s "Upload
  image" button goes through the same `onImportFiles` → `organization.createCategory("Book
  uploads")` → `importedMedia.importFiles` path chat's upload button uses, so an uploaded image
  lands in the file manager (not just on the page) the same way a chat upload does.

### Tasks module

A seventh sidebar module: `TasksView.tsx` (horizontally scrolling board), `TaskSectionColumn.tsx` (one section; its task list scrolls vertically), `TaskCard.tsx`, `TaskEditor.tsx` (modal). See `src/types/task.ts`.

- **Backend:** `db.taskSections` and `db.tasks` (`/api/task-sections`, `/api/tasks`); array order is display order. Moving a task is `PUT /api/tasks/:id` with a new `sectionId` and appends it to the end of that section. Deleting a section deletes its tasks.
- **Moves:** drag a card onto another column, or use the card's prev/next arrows or the section select in `TaskEditor`.
- **Content:** a task's body is `blocks` (the Notes block model: rich text, image/video `MediaItem` ids from the library or uploaded into the "Task uploads" category, and http(s) links). The server drops any other block or link scheme. A fresh board is seeded once with "New tasks", "Completed" and "Pending" sections.
- **Saves:** create/delete/move hit the server immediately; title/description/image edits update local state and save on a ~600ms per-task debounce (`flushTask` on editor close), like Notes.

### Teams module

A Microsoft Teams-style module: `TeamsView.tsx` (list + dialogs), `TeamsConversationPane.tsx`,
`TeamsMessageItem.tsx`, `TeamsComposer.tsx`; state in `useTeams.ts`; types in `types/teams.ts`.

- **Shared between accounts**, unlike every other module: it is not in a customer's store. The
  backend is `server/teams.mjs` (mounted at `/api/teams-app`, no active customer needed), saved
  in `server/data/teams.json` with files in `server/data/teams-files/`.
- **Access is checked on every route** through `canAccess()`; people without access get 404.
  Any new route or push must go through it, and needs a case in `server/teams.test.mjs`
  (`pnpm test`).
- People are added by exact email only, so accounts can't be listed.
- **Live updates are Server-Sent Events** that only say what changed; the client refetches.
  IIS needs ARR response buffering off (`scripts/setup-iis.ps1`).
- Only known image/audio/video types are served inline; everything else downloads.
- Not built yet: calls, screen sharing, typing indicator, reactions, search, notifications
  outside the Teams screen.
