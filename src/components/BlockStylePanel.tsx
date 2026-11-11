import { useRef, useState } from "react";
import type {
  Block,
  BlockStyle,
  Column,
  Section,
  SitePage,
} from "@/types/website";
import type { MediaItem } from "@/types/media";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import {
  BLOCK_BG_ORDER,
  BLOCK_BG_SWATCHES,
  BLOCK_TEXT_ORDER,
  BLOCK_TEXT_SWATCHES,
  BUILDER_ICONS,
  BUILDER_ICON_NAMES,
  SOCIAL_PLATFORMS,
  createDefaultBlock,
  makeId,
  sanitizeRichText,
} from "@/lib/websiteBlocks";
import { SliderRow } from "@/components/SliderRow";
import { CustomColorSwatch } from "@/components/CustomColorSwatch";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import type { SelectedPath } from "@/components/WebsitePageBlocks";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";

type Props = {
  selected: SelectedPath | null;
  block: Block | null;
  column: Column | null;
  section: Section | null;
  pages: SitePage[];
  mediaItems: MediaItem[];
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
  onUpdateBlock: (next: Block) => void;
  onUpdateColumn: (patch: Partial<Column>) => void;
  onUpdateSection: (patch: Partial<Section>) => void;
  onRemoveSelected: () => void;
};

// ---- small shared field primitives -----------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-stone">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-accent"
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-accent"
    />
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function SwatchRow({
  value,
  onChange,
  presets,
  order,
}: {
  value: string | undefined;
  onChange: (hex: string) => void;
  presets: Record<string, string>;
  order: string[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      {order.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === presets[key]}
          onClick={() => onChange(presets[key])}
          className={`size-5 shrink-0 rounded-full ring-1 ring-black/10 ${
            value === presets[key] ? "ring-2 ring-accent" : ""
          }`}
          style={{ backgroundColor: presets[key] }}
        />
      ))}
      <CustomColorSwatch onChange={onChange} />
    </div>
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex size-7 items-center justify-center rounded-md text-stone transition hover:bg-linen-hover"
    >
      {children}
    </button>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-accent transition hover:bg-accent/10"
    >
      <PlusIcon className="size-3" />
      {label}
    </button>
  );
}

function RemoveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton onClick={onClick} title="Remove">
      <TrashIcon className="size-3.5" />
    </IconButton>
  );
}

/** Picks an existing library item or uploads a fresh one — the one new convenience
 * every block's media fields need beyond what AttachMediaModal alone offers. */
function MediaPickerField({
  label,
  mediaId,
  mediaItems,
  typeFilter,
  onImportFiles,
  onChange,
}: {
  label: string;
  mediaId: string | null | undefined;
  mediaItems: MediaItem[];
  typeFilter: "image" | "video";
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
  onChange: (id: string | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const current = mediaId ? mediaItems.find((m) => m.id === mediaId) : null;

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <span className="font-medium text-stone">{label}</span>
      {current && (
        <div className="relative size-16 overflow-hidden rounded-md ring-1 ring-black/10">
          {current.type === "video" ? (
            <video
              src={current.src}
              muted
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={current.src}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-md px-2 py-1 text-xs font-medium text-accent ring-1 ring-accent/30 transition hover:bg-accent/10"
        >
          Choose
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover"
        >
          <UploadIcon className="size-3" />
          Upload
        </button>
        {mediaId && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
          >
            Clear
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={typeFilter === "video" ? "video/*" : "image/*"}
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          const result = await onImportFiles(files);
          if (result.items[0]) onChange(result.items[0].id);
          e.target.value = "";
        }}
      />
      {pickerOpen && (
        <AttachMediaModal
          items={mediaItems}
          typeFilter={typeFilter}
          multiple={false}
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            onChange(ids[0] ?? null);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LinkTargetFields({
  targetPageId,
  url,
  pages,
  onChange,
}: {
  targetPageId: string | null | undefined;
  url: string | undefined;
  pages: SitePage[];
  onChange: (next: { targetPageId: string | null; url?: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={targetPageId ?? ""}
        onChange={(e) =>
          onChange({
            targetPageId: e.target.value || null,
            url: e.target.value ? undefined : url,
          })
        }
        className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs outline-none"
      >
        <option value="">External URL…</option>
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title || "Untitled"}
          </option>
        ))}
      </select>
      {!targetPageId && (
        <TextInput
          placeholder="https://…"
          value={url ?? ""}
          onChange={(e) =>
            onChange({ targetPageId: null, url: e.target.value })
          }
        />
      )}
    </div>
  );
}

function AlignButtons({
  value,
  onChange,
}: {
  value: "left" | "center" | "right" | undefined;
  onChange: (v: "left" | "center" | "right") => void;
}) {
  const options = [
    { v: "left" as const, Icon: AlignLeftIcon },
    { v: "center" as const, Icon: AlignCenterIcon },
    { v: "right" as const, Icon: AlignRightIcon },
  ];
  return (
    <div className="flex gap-1">
      {options.map(({ v, Icon }) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`flex size-7 items-center justify-center rounded-md ring-1 transition ${
            value === v
              ? "bg-accent/10 text-accent ring-accent"
              : "text-stone ring-linen hover:bg-linen-hover"
          }`}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

// ---- shared style section (padding/margin/colors/radius/align/opacity) -----------

function SharedStyleFields({
  style,
  onChange,
}: {
  style: BlockStyle | undefined;
  onChange: (patch: Partial<BlockStyle>) => void;
}) {
  const uniformPadding = style?.paddingTop ?? 0;
  return (
    <div className="flex flex-col gap-3 border-t border-linen pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone">
        Style
      </p>
      <SliderRow
        label="Padding"
        value={uniformPadding}
        min={0}
        max={120}
        unit="px"
        onChange={(v) =>
          onChange({
            paddingTop: v,
            paddingRight: v,
            paddingBottom: v,
            paddingLeft: v,
          })
        }
      />
      <SliderRow
        label="Margin"
        value={style?.marginBottom ?? 0}
        min={0}
        max={120}
        unit="px"
        onChange={(v) => onChange({ marginBottom: v })}
      />
      <SliderRow
        label="Radius"
        value={style?.borderRadius ?? 0}
        min={0}
        max={48}
        unit="px"
        onChange={(v) => onChange({ borderRadius: v })}
      />
      <SliderRow
        label="Opacity"
        value={style?.opacity ?? 1}
        min={0.1}
        max={1}
        step={0.05}
        onChange={(v) => onChange({ opacity: v })}
      />
      <Field label="Align">
        <AlignButtons
          value={style?.textAlign}
          onChange={(v) => onChange({ textAlign: v })}
        />
      </Field>
      <Field label="Background">
        <SwatchRow
          value={style?.backgroundColor}
          onChange={(hex) => onChange({ backgroundColor: hex })}
          presets={BLOCK_BG_SWATCHES}
          order={BLOCK_BG_ORDER}
        />
      </Field>
      <Field label="Text color">
        <SwatchRow
          value={style?.textColor}
          onChange={(hex) => onChange({ textColor: hex })}
          presets={BLOCK_TEXT_SWATCHES}
          order={BLOCK_TEXT_ORDER}
        />
      </Field>
    </div>
  );
}

// ---- per-kind content editors -----------------------------------------------------

function BlockContentFields({
  block,
  pages,
  mediaItems,
  onImportFiles,
  onChange,
}: {
  block: Block;
  pages: SitePage[];
  mediaItems: MediaItem[];
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
  onChange: (next: Block) => void;
}) {
  switch (block.kind) {
    case "header":
      return (
        <>
          <Field label="Logo text">
            <TextInput
              value={block.logoText ?? ""}
              onChange={(e) => onChange({ ...block, logoText: e.target.value })}
            />
          </Field>
          <MediaPickerField
            label="Logo image"
            mediaId={block.logoMediaId}
            mediaItems={mediaItems}
            typeFilter="image"
            onImportFiles={onImportFiles}
            onChange={(id) => onChange({ ...block, logoMediaId: id })}
          />
          <Checkbox
            label="Sticky"
            checked={block.sticky ?? false}
            onChange={(v) => onChange({ ...block, sticky: v })}
          />
          <NavItemsEditor
            items={block.navItems}
            pages={pages}
            onChange={(navItems) => onChange({ ...block, navItems })}
          />
        </>
      );

    case "hero":
      return (
        <>
          <Field label="Heading">
            <TextInput
              value={block.heading}
              onChange={(e) => onChange({ ...block, heading: e.target.value })}
            />
          </Field>
          <Field label="Subheading">
            <TextArea
              rows={2}
              value={block.subheading ?? ""}
              onChange={(e) =>
                onChange({ ...block, subheading: e.target.value })
              }
            />
          </Field>
          <MediaPickerField
            label="Background image"
            mediaId={block.backgroundMediaId}
            mediaItems={mediaItems}
            typeFilter="image"
            onImportFiles={onImportFiles}
            onChange={(id) => onChange({ ...block, backgroundMediaId: id })}
          />
          <Field label="Align">
            <AlignButtons
              value={block.align}
              onChange={(v) => onChange({ ...block, align: v })}
            />
          </Field>
          <Field label="Button label">
            <TextInput
              value={block.ctaLabel ?? ""}
              onChange={(e) => onChange({ ...block, ctaLabel: e.target.value })}
            />
          </Field>
          <Field label="Button links to">
            <LinkTargetFields
              targetPageId={block.ctaTargetPageId}
              url={block.ctaUrl}
              pages={pages}
              onChange={({ targetPageId, url }) =>
                onChange({
                  ...block,
                  ctaTargetPageId: targetPageId,
                  ctaUrl: url,
                })
              }
            />
          </Field>
        </>
      );

    case "footer":
      return (
        <>
          <Field label="Footer text">
            <TextInput
              value={block.text ?? ""}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
            />
          </Field>
          <NavItemsEditor
            items={block.navItems}
            pages={pages}
            onChange={(navItems) => onChange({ ...block, navItems })}
          />
          <SocialLinksEditor
            links={block.socialLinks ?? []}
            onChange={(socialLinks) => onChange({ ...block, socialLinks })}
          />
        </>
      );

    case "columns":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-stone">
            Each column's blocks are managed as a simple list here —
            drag-and-drop placement is only for a section's top-level columns.
          </p>
          {block.columns.map((col, colIndex) => (
            <div key={col.id} className="rounded-md border border-linen p-2">
              <p className="mb-1.5 text-[11px] font-semibold text-stone">
                Column {colIndex + 1}
              </p>
              <SimpleBlockListEditor
                blocks={col.blocks}
                onChange={(blocks) => {
                  const columns = block.columns.map((c, i) =>
                    i === colIndex ? { ...c, blocks } : c,
                  );
                  onChange({ ...block, columns });
                }}
              />
            </div>
          ))}
        </div>
      );

    case "spacerDivider":
      return (
        <>
          <div className="flex gap-1.5">
            {(["spacer", "divider"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={block.variant === v}
                onClick={() => onChange({ ...block, variant: v })}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ring-1 ${
                  block.variant === v
                    ? "bg-accent/10 text-accent ring-accent"
                    : "text-stone ring-linen"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <SliderRow
            label="Height"
            value={block.height ?? 40}
            min={4}
            max={160}
            unit="px"
            onChange={(v) => onChange({ ...block, height: v })}
          />
          {block.variant === "divider" && (
            <Field label="Line color">
              <SwatchRow
                value={block.lineColor}
                onChange={(hex) => onChange({ ...block, lineColor: hex })}
                presets={BLOCK_BG_SWATCHES}
                order={BLOCK_BG_ORDER}
              />
            </Field>
          )}
        </>
      );

    case "richText":
      return (
        <RichTextEditor
          html={block.html}
          onChange={(html) => onChange({ ...block, html })}
        />
      );

    case "heading":
      return (
        <>
          <Field label="Text">
            <TextInput
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
            />
          </Field>
          <Field label="Level">
            <div className="flex gap-1">
              {([1, 2, 3, 4] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  aria-pressed={block.level === lvl}
                  onClick={() => onChange({ ...block, level: lvl })}
                  className={`size-7 rounded-md text-xs font-medium ring-1 ${
                    block.level === lvl
                      ? "bg-accent/10 text-accent ring-accent"
                      : "text-stone ring-linen"
                  }`}
                >
                  H{lvl}
                </button>
              ))}
            </div>
          </Field>
        </>
      );

    case "image":
      return (
        <>
          <MediaPickerField
            label="Image"
            mediaId={block.mediaId}
            mediaItems={mediaItems}
            typeFilter="image"
            onImportFiles={onImportFiles}
            onChange={(id) => onChange({ ...block, mediaId: id })}
          />
          <Field label="Alt text">
            <TextInput
              value={block.alt ?? ""}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
            />
          </Field>
          <Field label="Link URL">
            <TextInput
              value={block.linkUrl ?? ""}
              onChange={(e) => onChange({ ...block, linkUrl: e.target.value })}
            />
          </Field>
        </>
      );

    case "gallery":
      return (
        <>
          <Field label="Images">
            <GalleryPicker
              mediaIds={block.mediaIds}
              mediaItems={mediaItems}
              onImportFiles={onImportFiles}
              onChange={(mediaIds) => onChange({ ...block, mediaIds })}
            />
          </Field>
          <div className="flex gap-1.5">
            {(["grid", "carousel"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={block.layout === v}
                onClick={() => onChange({ ...block, layout: v })}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ring-1 ${
                  block.layout === v
                    ? "bg-accent/10 text-accent ring-accent"
                    : "text-stone ring-linen"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {block.layout === "grid" && (
            <SliderRow
              label="Columns"
              value={block.columns ?? 3}
              min={1}
              max={6}
              onChange={(v) => onChange({ ...block, columns: v })}
            />
          )}
        </>
      );

    case "video":
      return (
        <>
          <MediaPickerField
            label="Video file"
            mediaId={block.mediaId}
            mediaItems={mediaItems}
            typeFilter="video"
            onImportFiles={onImportFiles}
            onChange={(id) => onChange({ ...block, mediaId: id })}
          />
          <Field label="…or embed URL (YouTube/Vimeo)">
            <TextInput
              value={block.embedUrl ?? ""}
              onChange={(e) => onChange({ ...block, embedUrl: e.target.value })}
            />
          </Field>
          <Checkbox
            label="Controls"
            checked={block.controls ?? true}
            onChange={(v) => onChange({ ...block, controls: v })}
          />
          <Checkbox
            label="Autoplay"
            checked={block.autoplay ?? false}
            onChange={(v) => onChange({ ...block, autoplay: v })}
          />
          <Checkbox
            label="Loop"
            checked={block.loop ?? false}
            onChange={(v) => onChange({ ...block, loop: v })}
          />
        </>
      );

    case "button":
      return (
        <>
          <Field label="Label">
            <TextInput
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
            />
          </Field>
          <Field label="Links to">
            <LinkTargetFields
              targetPageId={block.targetPageId}
              url={block.url}
              pages={pages}
              onChange={({ targetPageId, url }) =>
                onChange({ ...block, targetPageId, url })
              }
            />
          </Field>
          <Field label="Style">
            <div className="flex gap-1.5">
              {(["solid", "outline", "ghost"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={block.variant === v}
                  onClick={() => onChange({ ...block, variant: v })}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ring-1 ${
                    block.variant === v
                      ? "bg-accent/10 text-accent ring-accent"
                      : "text-stone ring-linen"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
        </>
      );

    case "icon":
      return (
        <>
          <Field label="Icon">
            <IconPicker
              value={block.iconName}
              onChange={(iconName) => onChange({ ...block, iconName })}
            />
          </Field>
          <SliderRow
            label="Size"
            value={block.size ?? 32}
            min={12}
            max={96}
            unit="px"
            onChange={(v) => onChange({ ...block, size: v })}
          />
        </>
      );

    case "iconList":
      return (
        <>
          {block.items.map((item, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-md border border-linen p-2"
            >
              <div className="flex items-center justify-between">
                <IconPicker
                  value={item.iconName}
                  onChange={(iconName) => {
                    const items = block.items.map((it, j) =>
                      j === i ? { ...it, iconName } : it,
                    );
                    onChange({ ...block, items });
                  }}
                />
                <RemoveRowButton
                  onClick={() =>
                    onChange({
                      ...block,
                      items: block.items.filter((_, j) => j !== i),
                    })
                  }
                />
              </div>
              <TextInput
                placeholder="Title"
                value={item.title}
                onChange={(e) => {
                  const items = block.items.map((it, j) =>
                    j === i ? { ...it, title: e.target.value } : it,
                  );
                  onChange({ ...block, items });
                }}
              />
              <TextInput
                placeholder="Description"
                value={item.description ?? ""}
                onChange={(e) => {
                  const items = block.items.map((it, j) =>
                    j === i ? { ...it, description: e.target.value } : it,
                  );
                  onChange({ ...block, items });
                }}
              />
            </div>
          ))}
          <AddButton
            label="Add item"
            onClick={() =>
              onChange({
                ...block,
                items: [
                  ...block.items,
                  { iconName: "star", title: "New item" },
                ],
              })
            }
          />
          <SliderRow
            label="Columns"
            value={block.columns ?? 3}
            min={1}
            max={6}
            onChange={(v) => onChange({ ...block, columns: v })}
          />
        </>
      );

    case "testimonial":
      return (
        <>
          <Field label="Quote">
            <TextArea
              rows={3}
              value={block.quote}
              onChange={(e) => onChange({ ...block, quote: e.target.value })}
            />
          </Field>
          <Field label="Author name">
            <TextInput
              value={block.authorName}
              onChange={(e) =>
                onChange({ ...block, authorName: e.target.value })
              }
            />
          </Field>
          <Field label="Author role">
            <TextInput
              value={block.authorRole ?? ""}
              onChange={(e) =>
                onChange({ ...block, authorRole: e.target.value })
              }
            />
          </Field>
          <MediaPickerField
            label="Avatar"
            mediaId={block.authorAvatarMediaId}
            mediaItems={mediaItems}
            typeFilter="image"
            onImportFiles={onImportFiles}
            onChange={(id) => onChange({ ...block, authorAvatarMediaId: id })}
          />
        </>
      );

    case "pricingTable":
      return (
        <>
          {block.plans.map((plan, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-md border border-linen p-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-stone">
                  Plan {i + 1}
                </span>
                <RemoveRowButton
                  onClick={() =>
                    onChange({
                      ...block,
                      plans: block.plans.filter((_, j) => j !== i),
                    })
                  }
                />
              </div>
              <TextInput
                placeholder="Name"
                value={plan.name}
                onChange={(e) => {
                  const plans = block.plans.map((p, j) =>
                    j === i ? { ...p, name: e.target.value } : p,
                  );
                  onChange({ ...block, plans });
                }}
              />
              <div className="flex gap-1.5">
                <TextInput
                  placeholder="Price"
                  value={plan.price}
                  onChange={(e) => {
                    const plans = block.plans.map((p, j) =>
                      j === i ? { ...p, price: e.target.value } : p,
                    );
                    onChange({ ...block, plans });
                  }}
                />
                <TextInput
                  placeholder="/mo"
                  value={plan.period ?? ""}
                  onChange={(e) => {
                    const plans = block.plans.map((p, j) =>
                      j === i ? { ...p, period: e.target.value } : p,
                    );
                    onChange({ ...block, plans });
                  }}
                />
              </div>
              <TextArea
                placeholder="One feature per line"
                rows={3}
                value={plan.features.join("\n")}
                onChange={(e) => {
                  const plans = block.plans.map((p, j) =>
                    j === i
                      ? { ...p, features: e.target.value.split("\n") }
                      : p,
                  );
                  onChange({ ...block, plans });
                }}
              />
              <Checkbox
                label="Highlighted"
                checked={plan.highlighted ?? false}
                onChange={(v) => {
                  const plans = block.plans.map((p, j) =>
                    j === i ? { ...p, highlighted: v } : p,
                  );
                  onChange({ ...block, plans });
                }}
              />
            </div>
          ))}
          <AddButton
            label="Add plan"
            onClick={() =>
              onChange({
                ...block,
                plans: [
                  ...block.plans,
                  { name: "New plan", price: "$0", features: [] },
                ],
              })
            }
          />
        </>
      );

    case "faq":
      return (
        <>
          {block.items.map((item, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-md border border-linen p-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-stone">
                  Question {i + 1}
                </span>
                <RemoveRowButton
                  onClick={() =>
                    onChange({
                      ...block,
                      items: block.items.filter((_, j) => j !== i),
                    })
                  }
                />
              </div>
              <TextInput
                placeholder="Question"
                value={item.question}
                onChange={(e) => {
                  const items = block.items.map((it, j) =>
                    j === i ? { ...it, question: e.target.value } : it,
                  );
                  onChange({ ...block, items });
                }}
              />
              <TextArea
                placeholder="Answer"
                rows={2}
                value={item.answer}
                onChange={(e) => {
                  const items = block.items.map((it, j) =>
                    j === i ? { ...it, answer: e.target.value } : it,
                  );
                  onChange({ ...block, items });
                }}
              />
            </div>
          ))}
          <AddButton
            label="Add question"
            onClick={() =>
              onChange({
                ...block,
                items: [...block.items, { question: "", answer: "" }],
              })
            }
          />
        </>
      );

    case "team":
      return (
        <>
          {block.members.map((m, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-md border border-linen p-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-stone">
                  Member {i + 1}
                </span>
                <RemoveRowButton
                  onClick={() =>
                    onChange({
                      ...block,
                      members: block.members.filter((_, j) => j !== i),
                    })
                  }
                />
              </div>
              <MediaPickerField
                label="Photo"
                mediaId={m.photoMediaId}
                mediaItems={mediaItems}
                typeFilter="image"
                onImportFiles={onImportFiles}
                onChange={(id) => {
                  const members = block.members.map((mm, j) =>
                    j === i ? { ...mm, photoMediaId: id } : mm,
                  );
                  onChange({ ...block, members });
                }}
              />
              <TextInput
                placeholder="Name"
                value={m.name}
                onChange={(e) => {
                  const members = block.members.map((mm, j) =>
                    j === i ? { ...mm, name: e.target.value } : mm,
                  );
                  onChange({ ...block, members });
                }}
              />
              <TextInput
                placeholder="Role"
                value={m.role ?? ""}
                onChange={(e) => {
                  const members = block.members.map((mm, j) =>
                    j === i ? { ...mm, role: e.target.value } : mm,
                  );
                  onChange({ ...block, members });
                }}
              />
            </div>
          ))}
          <AddButton
            label="Add member"
            onClick={() =>
              onChange({
                ...block,
                members: [...block.members, { name: "New member" }],
              })
            }
          />
          <SliderRow
            label="Columns"
            value={block.columns ?? 3}
            min={1}
            max={6}
            onChange={(v) => onChange({ ...block, columns: v })}
          />
        </>
      );

    case "stats":
      return (
        <>
          {block.items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <TextInput
                placeholder="Value"
                value={item.value}
                onChange={(e) => {
                  const items = block.items.map((it, j) =>
                    j === i ? { ...it, value: e.target.value } : it,
                  );
                  onChange({ ...block, items });
                }}
              />
              <TextInput
                placeholder="Label"
                value={item.label}
                onChange={(e) => {
                  const items = block.items.map((it, j) =>
                    j === i ? { ...it, label: e.target.value } : it,
                  );
                  onChange({ ...block, items });
                }}
              />
              <RemoveRowButton
                onClick={() =>
                  onChange({
                    ...block,
                    items: block.items.filter((_, j) => j !== i),
                  })
                }
              />
            </div>
          ))}
          <AddButton
            label="Add stat"
            onClick={() =>
              onChange({
                ...block,
                items: [...block.items, { value: "0", label: "" }],
              })
            }
          />
        </>
      );

    case "socialLinks":
      return (
        <SocialLinksEditor
          links={block.links}
          onChange={(links) => onChange({ ...block, links })}
        />
      );

    case "map":
      return (
        <>
          <Field label="Address">
            <TextInput
              value={block.address ?? ""}
              onChange={(e) => onChange({ ...block, address: e.target.value })}
            />
          </Field>
          <Field label="…or embed URL">
            <TextInput
              value={block.embedUrl ?? ""}
              onChange={(e) => onChange({ ...block, embedUrl: e.target.value })}
            />
          </Field>
          <SliderRow
            label="Zoom"
            value={block.zoom ?? 14}
            min={1}
            max={20}
            onChange={(v) => onChange({ ...block, zoom: v })}
          />
        </>
      );

    case "form":
      return (
        <>
          {block.fields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-1.5">
              <TextInput
                placeholder="Label"
                value={field.label}
                onChange={(e) => {
                  const fields = block.fields.map((f, j) =>
                    j === i ? { ...f, label: e.target.value } : f,
                  );
                  onChange({ ...block, fields });
                }}
              />
              <select
                value={field.type}
                onChange={(e) => {
                  const fields = block.fields.map((f, j) =>
                    j === i
                      ? { ...f, type: e.target.value as typeof f.type }
                      : f,
                  );
                  onChange({ ...block, fields });
                }}
                className="rounded-md border border-neutral-300 px-1.5 py-1.5 text-xs"
              >
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="tel">Phone</option>
                <option value="textarea">Paragraph</option>
              </select>
              <RemoveRowButton
                onClick={() =>
                  onChange({
                    ...block,
                    fields: block.fields.filter((_, j) => j !== i),
                  })
                }
              />
            </div>
          ))}
          <AddButton
            label="Add field"
            onClick={() =>
              onChange({
                ...block,
                fields: [
                  ...block.fields,
                  { id: makeId("field"), label: "Field", type: "text" },
                ],
              })
            }
          />
          <Field label="Submit button label">
            <TextInput
              value={block.submitLabel ?? ""}
              onChange={(e) =>
                onChange({ ...block, submitLabel: e.target.value })
              }
            />
          </Field>
          <Field label="Sends to (email)">
            <TextInput
              type="email"
              value={block.recipientEmail ?? ""}
              onChange={(e) =>
                onChange({ ...block, recipientEmail: e.target.value })
              }
            />
          </Field>
          <p className="text-[11px] text-stone">
            Exported sites have no server, so submissions open the visitor's
            email app (a mailto: link) rather than posting anywhere.
          </p>
        </>
      );

    case "countdown":
      return (
        <Field label="Target date & time">
          <TextInput
            type="datetime-local"
            value={block.targetDate.slice(0, 16)}
            onChange={(e) =>
              onChange({
                ...block,
                targetDate: new Date(e.target.value).toISOString(),
              })
            }
          />
        </Field>
      );

    case "tabs":
      return (
        <div className="flex flex-col gap-3">
          {block.tabs.map((tab, i) => (
            <div key={i} className="rounded-md border border-linen p-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <TextInput
                  placeholder="Tab label"
                  value={tab.label}
                  onChange={(e) => {
                    const tabs = block.tabs.map((t, j) =>
                      j === i ? { ...t, label: e.target.value } : t,
                    );
                    onChange({ ...block, tabs });
                  }}
                />
                <RemoveRowButton
                  onClick={() =>
                    onChange({
                      ...block,
                      tabs: block.tabs.filter((_, j) => j !== i),
                    })
                  }
                />
              </div>
              <SimpleBlockListEditor
                blocks={tab.blocks}
                onChange={(blocks) => {
                  const tabs = block.tabs.map((t, j) =>
                    j === i ? { ...t, blocks } : t,
                  );
                  onChange({ ...block, tabs });
                }}
              />
            </div>
          ))}
          <AddButton
            label="Add tab"
            onClick={() =>
              onChange({
                ...block,
                tabs: [
                  ...block.tabs,
                  { label: `Tab ${block.tabs.length + 1}`, blocks: [] },
                ],
              })
            }
          />
        </div>
      );

    case "customHtml": {
      return <CustomHtmlEditor block={block} onChange={onChange} />;
    }
  }
}

// ---- heavier per-kind sub-editors --------------------------------------------------

const SIMPLE_LIST_BLOCK_KINDS = [
  "richText",
  "heading",
  "image",
  "button",
  "icon",
  "spacerDivider",
] as const;

/** Simplified add/remove-only block management used inside `columns`/`tabs` sub-lists —
 * the main canvas's drag system only addresses a section's top-level columns, so nested
 * content here is edited as a plain list instead. */
function SimpleBlockListEditor({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {blocks.map((b, i) => (
        <div
          key={b.id}
          className="flex items-center justify-between rounded-md bg-canvas px-2 py-1 text-xs"
        >
          <span className="capitalize text-ink">{b.kind}</span>
          <RemoveRowButton
            onClick={() => onChange(blocks.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <select
        value=""
        onChange={(e) => {
          const kind = e.target.value as Block["kind"];
          if (!kind) return;
          onChange([...blocks, createDefaultBlock(kind)]);
        }}
        className="rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-400"
      >
        <option value="">+ Add block…</option>
        {SIMPLE_LIST_BLOCK_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </div>
  );
}

function NavItemsEditor({
  items,
  pages,
  onChange,
}: {
  items: { label: string; targetPageId: string | null; url?: string }[];
  pages: SitePage[];
  onChange: (
    items: { label: string; targetPageId: string | null; url?: string }[],
  ) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold text-stone">Nav links</p>
      {items.map((item, i) => (
        <div
          key={i}
          className="flex flex-col gap-1 rounded-md border border-linen p-1.5"
        >
          <div className="flex items-center gap-1.5">
            <TextInput
              placeholder="Label"
              value={item.label}
              onChange={(e) => {
                const next = items.map((it, j) =>
                  j === i ? { ...it, label: e.target.value } : it,
                );
                onChange(next);
              }}
            />
            <RemoveRowButton
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            />
          </div>
          <LinkTargetFields
            targetPageId={item.targetPageId}
            url={item.url}
            pages={pages}
            onChange={({ targetPageId, url }) => {
              const next = items.map((it, j) =>
                j === i ? { ...it, targetPageId, url } : it,
              );
              onChange(next);
            }}
          />
        </div>
      ))}
      <AddButton
        label="Add link"
        onClick={() =>
          onChange([...items, { label: "Link", targetPageId: null }])
        }
      />
    </div>
  );
}

function SocialLinksEditor({
  links,
  onChange,
}: {
  links: { platform: (typeof SOCIAL_PLATFORMS)[number]; url: string }[];
  onChange: (
    links: { platform: (typeof SOCIAL_PLATFORMS)[number]; url: string }[],
  ) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold text-stone">Social links</p>
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={link.platform}
            onChange={(e) => {
              const next = links.map((l, j) =>
                j === i
                  ? {
                      ...l,
                      platform: e.target
                        .value as (typeof SOCIAL_PLATFORMS)[number],
                    }
                  : l,
              );
              onChange(next);
            }}
            className="rounded-md border border-neutral-300 px-1.5 py-1.5 text-xs capitalize"
          >
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <TextInput
            placeholder="https://…"
            value={link.url}
            onChange={(e) => {
              const next = links.map((l, j) =>
                j === i ? { ...l, url: e.target.value } : l,
              );
              onChange(next);
            }}
          />
          <RemoveRowButton
            onClick={() => onChange(links.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <AddButton
        label="Add link"
        onClick={() => onChange([...links, { platform: "other", url: "" }])}
      />
    </div>
  );
}

function GalleryPicker({
  mediaIds,
  mediaItems,
  onImportFiles,
  onChange,
}: {
  mediaIds: string[];
  mediaItems: MediaItem[];
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
  onChange: (ids: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {mediaIds.map((id) => {
          const item = mediaItems.find((m) => m.id === id);
          return (
            <div
              key={id}
              className="relative size-12 overflow-hidden rounded-md ring-1 ring-black/10"
            >
              {item && (
                <img
                  src={item.src}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => onChange(mediaIds.filter((i) => i !== id))}
                className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition hover:bg-black/40 hover:text-white"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-md px-2 py-1 text-xs font-medium text-accent ring-1 ring-accent/30 transition hover:bg-accent/10"
        >
          Choose
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover"
        >
          <UploadIcon className="size-3" />
          Upload
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          const result = await onImportFiles(files);
          onChange([...mediaIds, ...result.items.map((it) => it.id)]);
          e.target.value = "";
        }}
      />
      {pickerOpen && (
        <AttachMediaModal
          items={mediaItems}
          typeFilter="image"
          multiple
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            onChange([
              ...mediaIds,
              ...ids.filter((id) => !mediaIds.includes(id)),
            ]);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {BUILDER_ICON_NAMES.map((name) => {
        const Icon = BUILDER_ICONS[name];
        return (
          <button
            key={name}
            type="button"
            aria-pressed={value === name}
            onClick={() => onChange(name)}
            className={`flex size-7 items-center justify-center rounded-md ring-1 transition ${
              value === name
                ? "bg-accent/10 text-accent ring-accent"
                : "text-stone ring-linen hover:bg-linen-hover"
            }`}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

const RICH_TEXT_COMMANDS: { cmd: string; label: string }[] = [
  { cmd: "bold", label: "B" },
  { cmd: "italic", label: "I" },
  { cmd: "underline", label: "U" },
  { cmd: "insertUnorderedList", label: "•" },
];

/** A small contentEditable + document.execCommand editor, same mechanism
 * NoteTextBlock.tsx uses for Notes — no rich-text-editor dependency. */
function RichTextEditor({
  html,
  onChange,
}: {
  html: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        {RICH_TEXT_COMMANDS.map(({ cmd, label }) => (
          <button
            key={cmd}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              document.execCommand(cmd);
              if (ref.current)
                onChange(sanitizeRichText(ref.current.innerHTML));
            }}
            className="flex size-7 items-center justify-center rounded-md text-xs font-semibold text-stone ring-1 ring-linen hover:bg-linen-hover"
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: html }}
        onInput={() => {
          if (ref.current) onChange(sanitizeRichText(ref.current.innerHTML));
        }}
        className="min-h-20 rounded-md border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-accent"
      />
    </div>
  );
}

function CustomHtmlEditor({
  block,
  onChange,
}: {
  block: Block & { kind: "customHtml" };
  onChange: (next: Block) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-stone">HTML</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover"
        >
          <UploadIcon className="size-3" />
          Load from file
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          onChange({ ...block, html: text });
          e.target.value = "";
        }}
      />
      <TextArea
        rows={8}
        value={block.html}
        onChange={(e) => onChange({ ...block, html: e.target.value })}
        className="font-mono"
      />
      <Field label="CSS">
        <TextArea
          rows={6}
          value={block.css}
          onChange={(e) => onChange({ ...block, css: e.target.value })}
          className="font-mono"
        />
      </Field>
      <SliderRow
        label="Height"
        value={block.height ?? 300}
        min={60}
        max={1200}
        unit="px"
        onChange={(v) => onChange({ ...block, height: v })}
      />
      <p className="text-[11px] text-stone">
        Renders in a sandboxed iframe — scripts run, but the builder's own
        styles never leak in or out.
      </p>
    </>
  );
}

// ---- top-level panel ---------------------------------------------------------------

export function BlockStylePanel({
  selected,
  block,
  column,
  section,
  pages,
  mediaItems,
  onImportFiles,
  onUpdateBlock,
  onUpdateColumn,
  onUpdateSection,
  onRemoveSelected,
}: Props) {
  if (!selected) {
    return (
      <div className="flex w-72 shrink-0 items-center justify-center border-l border-linen bg-white px-4 text-center text-xs text-neutral-400">
        Select a block, column, or section to edit it.
      </div>
    );
  }

  const title =
    selected.scope === "slot"
      ? selected.slot
      : selected.scope === "section"
        ? "Section"
        : selected.scope === "column"
          ? "Column"
          : (block?.kind ?? "Block");

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-linen bg-white px-3 py-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold capitalize text-ink">{title}</p>
        {selected.scope !== "column" && (
          <IconButton onClick={onRemoveSelected} title="Remove">
            <TrashIcon className="size-4 text-red-500" />
          </IconButton>
        )}
      </div>

      {block && (
        <BlockContentFields
          block={block}
          pages={pages}
          mediaItems={mediaItems}
          onImportFiles={onImportFiles}
          onChange={onUpdateBlock}
        />
      )}

      {block && (
        <SharedStyleFields
          style={block.style}
          onChange={(patch) =>
            onUpdateBlock({ ...block, style: { ...block.style, ...patch } })
          }
        />
      )}

      {selected.scope === "column" && column && (
        <>
          <SliderRow
            label="Width"
            value={Math.round(column.widthFraction * 100)}
            min={10}
            max={100}
            unit="%"
            onChange={(v) => onUpdateColumn({ widthFraction: v / 100 })}
          />
          <SharedStyleFields
            style={column.style}
            onChange={(patch) =>
              onUpdateColumn({ style: { ...column.style, ...patch } })
            }
          />
        </>
      )}

      {selected.scope === "section" && section && (
        <>
          <Checkbox
            label="Full width (no max-width)"
            checked={section.fullBleed ?? false}
            onChange={(v) => onUpdateSection({ fullBleed: v })}
          />
          <SharedStyleFields
            style={section.style}
            onChange={(patch) =>
              onUpdateSection({ style: { ...section.style, ...patch } })
            }
          />
        </>
      )}
    </div>
  );
}
