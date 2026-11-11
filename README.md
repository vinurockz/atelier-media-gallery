# Media Gallery

A React + Vite media gallery with a Google Drive-style UI: a left sidebar,
a "My Drive" home screen of category "folders" (each with a cover
thumbnail), folders inside each category, and inside each one a Videos
section and a Pictures section with its own color filter. Any folder with
content can be downloaded as a .zip, and a .zip of videos/pictures can be
imported straight back in. Videos open in a full-screen / picture-in-picture
player; pictures in a matching full-screen viewer.

## Drive-style navigation

- **Sidebar** — "My Drive" plus every category, each showing its item count
  and its assigned color (if any). Click a category to jump straight in.
- **Breadcrumbs** — "My Drive › Category › Folder" across the top of every
  screen; click any earlier crumb to jump back. There's no separate "back"
  button — the breadcrumb trail is the only way up, same as Drive.
- **Grid / List toggle** — top-right of every screen. The choice is
  remembered (`localStorage`) and applies everywhere: the home screen,
  folders, and every Videos/Pictures section. See `src/hooks/useViewMode.ts`.
- **Right-click menus** — right-click any card or folder tile for a
  Drive-style context menu: Open, Download, Move to…, Rename, Delete, and
  (folders/categories only) Folder color. These are in addition to the
  hover kebab menu and the pencil/trash icons — whichever you reach for.
  See `src/components/ContextMenu.tsx`.
- **Folder color** — right-click a folder or category → *Folder color* to
  tag it, like Drive's colored folder icons. Shown as a small dot on the
  tile (grid) or tint on the folder icon (list), and in the sidebar.
  Stored per category/folder in the same `localStorage` organization layer
  as renames and moves — see `getFolderColor`/`setFolderColor` in
  `src/hooks/useOrganization.ts`.

## Run it

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm build     # production build to dist/
```

`pnpm dev` and `pnpm build` both run the video-conversion step first (see
below), so new files are picked up automatically.

## Adding media — two ways to assign a category

**On disk (the source of truth).** A video or picture is assigned to a
category by which folder you put it in:

```
src/assets/videos/<Category>/<file>.mp4
src/assets/images/<Category>/<file>.jpg|png|webp|avif|gif
```

- The folder name **is** the category. Create a new folder to create a new
  category (e.g. `src/assets/videos/Travel/`); delete/empty it to remove one.
- File name becomes the title (`sunrise-timelapse.mp4` → "Sunrise Timelapse").
- No code changes needed — `src/lib/media.ts` discovers everything with a
  Vite glob import at build/dev time.

**In the app (file-manager style, no rebuild needed).** Once media shows up,
you can reorganize it from the UI itself, the same way you would in a
desktop file manager:

- **Rename a category or folder** — click the pencil next to its name, on
  the tile or inside its detail view. Renames only change the display name
  (categories) or rewrite the folder's stored name (folders); they don't
  touch files on disk.
- **Create folders inside a category** — open a category and use the "New
  folder" tile under *Folders*. A category can hold any number of folders.
- **Move an item** — three ways, all equivalent:
  - Click the ⋮ menu on any card and pick a target. Inside a category this
    offers two groups: *Move to folder* (within the current category, or
    "＋ New folder…") and *Move to category* (top-level, or "＋ New
    category…").
  - **Drag the card's thumbnail** onto a folder tile (or a category tile on
    the home screen) to move it there.
  - **Multi-select**: click "Select" in a category/folder header, click
    cards to check them (works across both the Videos and Pictures
    sections at once), then "Move to…" in the bar that appears.
- **Create an empty category** — the "New category" tile on the home screen.
- **Delete a category or folder** — hover it and click the trash icon (or
  the one next to its name inside the detail view). This never deletes the
  underlying media: a deleted folder's items fall back to "Unsorted" in
  their category; a deleted category's items fall back to a new
  "Uncategorized" category. You're asked to confirm first.
- **Delete a video or picture** — its ⋮ menu (and the right-click context
  menu) has a "Delete" entry below the move list. For a filesystem item
  (one that lives in `src/assets/`) this just hides it from the gallery —
  the file is untouched on disk, since there's nowhere else for a
  client-only app to "delete" it to. For an item you imported (zip, drag,
  or restored backup), it's permanent: its bytes are removed from
  IndexedDB for good. The confirm dialog tells you which kind it is before
  you commit. See `deleteItem` in `src/hooks/useOrganization.ts` and
  `src/hooks/useImportedMedia.ts`.
- **Multi-select bulk actions** — besides bulk move, the selection bar also
  has "Download ZIP" and "Delete" (same non-destructive-for-filesystem /
  permanent-for-imported rules as single-item delete, confirmed once for
  the whole selection) to act on every selected item at once.

## File details — size and upload time

The list view (not grid, to keep the grid visually clean) shows two extra
columns per item:

- **Size**, formatted into B/KB/MB/GB/TB (whichever keeps it readable) —
  known immediately for imported items (`blob.size`); lazily fetched via a
  `HEAD` request and cached for bundled assets, since those don't carry
  size metadata at build time. See `src/lib/formatBytes.ts`,
  `src/lib/fileSize.ts`, `src/hooks/useMediaSizes.ts`.
- **Uploaded**, the real import timestamp for files you added — zip
  import, drag-and-drop, chat upload, or restored backup. Bundled assets
  show "Bundled asset" instead of a fabricated date, since there's no
  real "upload" for something that shipped with the app.

## Back it all up, or restore it

Since every file here lives only on this machine (bundled assets plus
whatever you've imported), the sidebar has a **Backup** section:

- **Export everything** zips every category and folder as a real,
  browsable directory tree — `Category/file.ext` or
  `Category/Folder/file.ext` — not a flat pile. Extract it with any zip
  tool and it looks like a normal media folder.
- **Restore from backup** reads that zip (or any zip laid out the same
  way) back in, recreating categories and folders to match. If an item
  already exists here — by title and type, e.g. you're restoring onto the
  same install where the bundled assets never went anywhere — it's
  **repositioned** to match the backup's category/folder instead of being
  imported as a second copy, so restoring never doubles your library.
  Only genuinely new items (ones only the backup has) get imported.
  See `downloadBackupZip`/`extractBackupZip` in `src/lib/zip.ts` and
  `exportAll`/`importBackup` in `src/App.tsx`.

This organization layer lives in the browser's `localStorage`
(`media-gallery:organization:v2`) — it's per-browser and doesn't touch the
files on disk. Clearing site data resets categories/folders back to whatever
the `src/assets/` folders say (imported zip files are separate — see below).
See `src/hooks/useOrganization.ts`.

## Zipping a folder up / importing a zip back in

Every category and every folder has **Download ZIP** and **Import ZIP**
buttons in its header:

- **Download ZIP** fetches the current source (bundled asset, dev-server
  file, or an imported blob) for every video/picture in that folder or
  category and packs them into one `.zip`, named after it — e.g.
  `City-Downtown.zip`. Disabled when there's nothing to zip.
- **Import ZIP** reads a `.zip` entirely client-side (via `JSZip`, loaded
  on demand so it's not in the main bundle) and adds every image
  (`jpg/jpeg/png/webp/avif/gif`) and browser-native video (`mp4`/`webm`)
  it finds, flattening any folders inside the zip. Anything else (e.g. an
  `.mpg`/`.mov`/`.avi` clip) is skipped with an explanation — there's no
  server here to transcode it the way `scripts/convert-videos.mjs` does
  for files added to the repo; convert it to `.mp4` first if you need it
  playable.
- Imported files are assigned to whichever category/folder you imported
  into, and their bytes are kept in **IndexedDB**
  (`media-gallery-imports`) so they survive a reload — unlike a plain
  `URL.createObjectURL()`, which dies with the page. See
  `src/lib/zip.ts` and `src/hooks/useImportedMedia.ts`.

## Dragging files in from your computer

You don't need a zip for a quick add: drag image/video files straight from
your OS file manager and drop them —

- **onto a folder tile** to import directly into that folder;
- **anywhere else in a category or folder view** to import into that
  category's Unsorted bucket (or that folder, if you're inside one);
- **onto the home screen** (outside any tile) to create a new "Dropped
  files" category for them.

Same format rules as zip import: images and native `mp4`/`webm` video are
accepted; anything else is skipped with an on-screen reason. This uses the
same `useImportedMedia` pipeline as zip import, just skipping the
unzip step — see `classifyDroppedFiles` in `src/lib/zip.ts` and
`src/hooks/useFileDropZone.ts`.

### Video formats that aren't `.mp4`/`.webm`

Browsers can't play `.mov`, `.mkv`, `.avi`, `.wmv`, `.mpg`/`.mpeg`/`.mpt`,
`.ts`, `.3gp`, and similar formats directly. Drop the file into its category
folder as-is:

```
src/assets/videos/Nature/sunrise-timelapse.mov
```

and run:

```bash
pnpm media:convert
```

(also runs automatically before `dev`/`build`). It transcodes the file with
`ffmpeg` (bundled via `ffmpeg-static`, no system install needed) to H.264/AAC
MP4 at `src/assets/videos/<Category>/_converted/<name>.mp4`, which is what
the gallery actually displays. The original file is left untouched; only
files newer than their existing converted output are re-converted.
`_converted/` is git-ignored — it's a build artifact, not something to
commit.

### Sample placeholder content

`scripts/generate-sample-media.mjs` generated the sample clips/images
currently in `src/assets/` (solid-color test videos and PNGs across
Nature/City/Abstract categories) so the gallery isn't empty. Replace them
with real footage/photos the same way — just overwrite or add files in those
folders. Re-run the generator only if you want to regenerate the placeholders.

## Player features

- **Full screen** — every video and picture viewer has a "Full screen"
  button (`element.requestFullscreen()`), plus native browser controls.
- **Picture-in-picture** — videos get a "PiP" button
  (`video.requestPictureInPicture()`), shown only when the browser supports
  it (feature-detected; Chromium/Edge/Safari support it, some browsers
  don't).
- **Skip ±10s / ±30s** — a row of skip buttons under the video's title bar
  adjusts `video.currentTime` directly, clamped to the clip's duration.
- **Slideshow** — opening a picture (not a video) shows a "Slideshow"
  button top-left of the lightbox; it auto-advances through the current
  filtered set every 4 seconds, with ←/→ and the arrow buttons still
  working to jump around manually while it plays. Toggles to "Pause".
- **Lightbox** — click any card to open it full-size with Escape to close
  and ←/→ to move between items in the current filtered set.

## Navigation and filtering

- **Home screen** — a grid of category folders. Each tile shows a cover
  thumbnail (the category's first item), an item count, and video/picture
  sub-counts.
- **Inside a category** — a *Folders* grid (create as many as you like),
  then whatever's directly in the category ("Unsorted") as a *Videos*
  section and a *Pictures* section.
- **Inside a folder** — the same *Videos*/*Pictures* split, scoped to just
  that folder.
- **Color filter, scoped per section** — every Videos/Pictures section
  (at the category level or inside a folder) has its own row of color
  swatches, independent of every other section. Each image and each video's
  extracted first frame is sampled client-side (`<canvas>`, no server/build
  step) and bucketed into a named color (red, orange, yellow, green, teal,
  blue, purple, pink, brown, white, gray, black). Only colors actually
  present in that section show up as swatches. See `src/lib/color.ts`.

## Project layout

```
scripts/
  convert-videos.mjs         Non-native video → MP4 conversion (ffmpeg)
  generate-sample-media.mjs  One-off placeholder content generator
src/
  assets/
    videos/<Category>/...
    images/<Category>/...
  lib/
    media.ts              Glob-based manifest: folders → MediaItem[]
    color.ts              Canvas-based dominant-color extraction + classification
    zip.ts                 Zip a list of items up / extract media from an uploaded zip
    importedMediaDb.ts     IndexedDB wrapper for imported file bytes
  hooks/
    useMediaColors.ts     Lazily computes colors for a list of items
    useOrganization.ts    localStorage-backed categories/folders/renames/moves
    useImportedMedia.ts   Loads imported items from IndexedDB; importZip()
  components/
    FolderGrid.tsx, FolderTile.tsx, NewFolderTile.tsx   Generic folder grid (home + inside a category)
    CategoryDetailView.tsx, FolderDetailView.tsx, MediaTypeSection.tsx
    EditableLabel.tsx     Click-to-rename text for category/folder names
    MoveToMenu.tsx         "Move to folder / category…" card menu
    ZipToolbar.tsx         Download ZIP / Import ZIP buttons
    VideoPlayer.tsx        Full screen + PiP video player
    ImageViewer.tsx        Full screen picture viewer (same toolbar style)
    MediaCard.tsx          Grid thumbnail (video poster frame / image)
    MediaLightbox.tsx      Modal viewer with prev/next + keyboard nav
    ColorFilter.tsx
  App.tsx
```

## Chat (a second module, next to Files)

The sidebar has a **Files / Chat** switcher at the top. Chat is a single
shared conversation simulated entirely client-side — no backend, no
accounts — meant for trying out a chat UI or a multi-person demo on one
machine:

- **Add users** from the sidebar (the "+" button there becomes "Add user"
  in Chat mode); each gets an auto-assigned avatar color.
- **"Chatting as"** — click a user in the sidebar to switch who you're
  sending as. Your own messages are right-aligned/blue; everyone else's
  are left-aligned/gray with their name — exactly like a normal chat UI,
  just with the "which account am I" switch exposed instead of hidden
  behind a login.
- **Attachments, two ways** — the composer's image icon opens a picker
  over your existing file-manager library (`AttachMediaModal.tsx`); the
  paperclip uploads straight from your device. Either way the attachment
  is a real `MediaItem`: device uploads land in the file manager too,
  under an auto-created "Chat uploads" category, so they're not
  chat-only — click a thumbnail in a bubble to open it in the same
  lightbox the file manager uses.
- Everything (users, messages, who's active) persists in `localStorage`
  (`media-gallery:chat:v1`) — see `src/hooks/useChat.ts`.

## Editor (a third module)

The sidebar's **Files / Chat / Edit** switcher has a third tab: pick a
photo or video from your library and customize it. Edits are always saved
as a brand-new file next to the source — nothing is ever overwritten.

Modeled on the common "troll"/meme-sticker app pattern (preset
sticker/emoji overlays plus bold captions on a photo or video) rather
than any single specific app — see `## Editor module ("troll editor")`
in [CLAUDE.md](CLAUDE.md) for the convention and research notes.

**Layout** — both editors follow a theme/page-builder-style shell (think
a Shopify-admin-style editor): a top bar (back, title, tools, undo/redo,
zoom, Save — `src/components/EditorTopBar.tsx`), a left tree of what's on
the canvas, a center preview, and a right panel that only shows settings
for whatever's currently selected. Clicking an item in the left tree *or*
on the canvas selects the same thing, same as that kind of editor. The
photo editor's left tree (`src/components/ImageLayersPanel.tsx`) lists
Photo / Header / each layer / Footer; selecting a layer also shows a
small floating Duplicate/Delete toolbar right under it on the canvas.
Video doesn't have free-form layers, so its left side is a simpler
section list (Trim / Captions / Adjustments / Transform / Watermark)
instead of a tree.

**Photo editor** (`src/components/ImageEditor.tsx`) — a canvas-based,
Photoshop-inspired meme editor:
- **Top text / Bottom text / Add text** — bold, outlined, draggable text
  layers (click a tool to add one, drag it anywhere on the photo).
- **Speech bubble** — a comic-style bubble with a tail, wrapped text
  inside, draggable like any other layer — drop it next to a person in
  the photo for a "conversation" effect.
- **Stickers** — a palette of emoji, added as draggable layers.
- **Shapes** — rectangle, ellipse, line, with fill + stroke color, also
  draggable layers.
- **Draw** — a freehand doodle tool (color + brush size), its own tool
  mode alongside Select/Crop/Eyedropper.
- **Adjustments** — continuous sliders for brightness, contrast,
  saturation, hue, grayscale, sepia, invert, blur, and pixelate, applied
  to the photo itself (not the overlays).
- **Sharpen** — a one-click unsharp-mask filter (a destructive bake,
  unlike everything else here — see the note in
  [CLAUDE.md](CLAUDE.md)).
- **Crop** — drag a selection on the photo, then "Apply crop". Non-
  destructive: it's stored as a crop rectangle, not baked into pixels,
  so it composes cleanly with rotate/flip/adjustments and stays undoable.
- **Rotate / Flip** — 90°/180°/270° rotate, flip horizontal/vertical.
- **Eyedropper** — click the photo to pick a color, used as the draw
  tool's (and new shapes') color.
- **Zoom** — scales the on-screen canvas only; export is always at full
  resolution regardless of zoom level.
- **Undo / Redo** — full history, `Ctrl/Cmd+Z` and `Ctrl/Cmd+Y` (or
  `+Shift+Z`), plus buttons. Granular: most edits are one history entry
  each (including each slider tick and textarea keystroke — see
  [CLAUDE.md](CLAUDE.md) for why), but dragging a layer, drawing a
  stroke, or dragging a crop selection is captured as a single entry for
  the whole gesture, not one per pixel of movement.
- **Header / Footer** — optional colored strips above/below the photo
  with their own centered text, independent of the draggable layers.
- **Background** — the color of the frame around the whole composition
  (visible as padding, especially alongside header/footer).
- Every text/bubble/sticker/shape layer has its own size, opacity, and
  color controls. "Save to file manager" exports the canvas at the
  photo's full native (post-crop) resolution as a PNG.

**Video editor** (`src/components/VideoEditor.tsx`) — trim and customize a
clip:
- Two range sliders pick the start/end of the portion you want; "Preview
  range" plays just that span.
- Optional top/bottom captions, burned directly into the frames (same
  bold-outlined style as the photo editor's text).
- The same **adjustments** panel as the photo editor, plus **rotate /
  flip** and **crop margins** (top/bottom/left/right, as a percentage —
  simpler than a drag-to-select marquee, since there's no live scrubbing
  preview of the crop while the clip is playing).
- **Playback speed** (0.5×–2×, which genuinely speeds up or slows down
  the exported clip — it changes `video.playbackRate` during capture),
  an **emoji watermark** (bottom-right corner), and a **mute** toggle to
  drop the audio track from the export.
- "Save trimmed clip" re-records the chosen range in real time via
  `canvas.captureStream()` + `MediaRecorder` — deliberately not
  ffmpeg.wasm, to avoid a multi-megabyte new dependency for something the
  browser can already do natively. Output is WebM (video + audio track,
  when the source has one and you haven't muted it), which this app
  already treats as a first-class native format. Needs a Chromium-based
  browser; unsupported browsers get a clear message instead of a silent
  failure.

Shared canvas-drawing code (so neither editor duplicates it) lives in
`src/lib/memeText.ts` (per-layer: text, speech bubble, sticker, shape)
and `src/lib/canvasDraw.ts` (whole-canvas: adjustments, sharpen, freehand
strokes); the adjustments slider UI itself is
`src/components/AdjustmentsPanel.tsx`, shared by both editors.

See [CLAUDE.md](CLAUDE.md) for coding conventions used in this project.
