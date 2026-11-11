import type { CSSProperties, ReactNode } from "react";
import type { Block, BlockStyle, Section, SitePage } from "@/types/website";
import {
  BUILDER_ICONS,
  SOCIAL_ICON_BY_PLATFORM,
  countdownScript,
  sanitizeRichText,
} from "@/lib/websiteBlocks";

export type SelectedPath =
  | { scope: "slot"; slot: "header" | "hero" | "footer" }
  | { scope: "section"; sectionId: string }
  | { scope: "column"; sectionId: string; columnId: string }
  | { scope: "block"; sectionId: string; columnId: string; blockId: string };

export interface RenderContext {
  resolveMediaUrl: (mediaId: string) => string;
  /** Resolves a nav/button/hero-CTA target to a URL. Falls back to `url` (an
   * external link) when no `targetPageId` is given. */
  resolveInternalLink: (
    targetPageId: string | null | undefined,
    url?: string,
  ) => string;
}

export interface InteractiveProps {
  selected: SelectedPath | null;
  onSelect: (path: SelectedPath) => void;
  onBlockPointerDown: (
    e: React.PointerEvent,
    sectionId: string,
    columnId: string,
    blockId: string,
  ) => void;
  registerColumnEl: (
    sectionId: string,
    columnId: string,
    el: HTMLElement | null,
  ) => void;
  /** Header/hero/footer are fixed, optional slots rather than draggable drop zones —
   * simpler than hit-testing a drag against the top/bottom of the page, and a slot is
   * only ever populated/cleared one at a time anyway. */
  onAddSlotBlock: (slot: "header" | "hero" | "footer") => void;
}

type Props = {
  page: SitePage;
  ctx: RenderContext;
  /** Omitted for live preview / export — only the editing canvas passes this, which is
   * also the only context where Tailwind classes (selection rings, hover states) may
   * appear; every other visual property here is a plain inline style so the same markup
   * renders identically with no external stylesheet during preview/export. */
  interactive?: InteractiveProps;
};

function styleToCss(style: BlockStyle | undefined): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  if (style.paddingTop != null) css.paddingTop = style.paddingTop;
  if (style.paddingRight != null) css.paddingRight = style.paddingRight;
  if (style.paddingBottom != null) css.paddingBottom = style.paddingBottom;
  if (style.paddingLeft != null) css.paddingLeft = style.paddingLeft;
  if (style.marginTop != null) css.marginTop = style.marginTop;
  if (style.marginBottom != null) css.marginBottom = style.marginBottom;
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.textColor) css.color = style.textColor;
  if (style.fontSize != null) css.fontSize = style.fontSize;
  if (style.fontWeight != null) css.fontWeight = style.fontWeight;
  if (style.textAlign) css.textAlign = style.textAlign;
  if (style.borderRadius != null) css.borderRadius = style.borderRadius;
  if (style.borderWidth != null) {
    css.borderWidth = style.borderWidth;
    css.borderStyle = "solid";
    css.borderColor = style.borderColor ?? "#dadce0";
  }
  if (style.maxWidth != null) {
    css.maxWidth = style.maxWidth;
    css.marginLeft = "auto";
    css.marginRight = "auto";
  }
  if (style.opacity != null) css.opacity = style.opacity;
  return css;
}

/** Selection-ring/hover classes for editor-only chrome — never applied in preview/export. */
function selectableClass(isSelected: boolean): string {
  return isSelected
    ? "outline outline-2 outline-accent outline-offset-1"
    : "outline outline-1 outline-transparent hover:outline-accent/40";
}

function NavLinks({
  items,
  ctx,
  style,
}: {
  items: { label: string; targetPageId: string | null; url?: string }[];
  ctx: RenderContext;
  style?: CSSProperties;
}) {
  return (
    <>
      {items.map((item, i) => (
        <a
          key={i}
          href={ctx.resolveInternalLink(item.targetPageId, item.url)}
          style={{ textDecoration: "none", color: "inherit", ...style }}
        >
          {item.label}
        </a>
      ))}
    </>
  );
}

function ctaButtonStyle(variant: "solid" | "outline" | "ghost"): CSSProperties {
  const base: CSSProperties = {
    display: "inline-block",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  };
  if (variant === "solid")
    return { ...base, backgroundColor: "#1a73e8", color: "#ffffff" };
  if (variant === "outline")
    return {
      ...base,
      backgroundColor: "transparent",
      color: "#1a73e8",
      border: "1px solid #1a73e8",
    };
  return { ...base, backgroundColor: "transparent", color: "#1a73e8" };
}

/** Renders one block's content. Nested blocks (inside a `columns`/`tabs` block) call
 * back into this with the same `ctx` but no `interactive` — only top-level blocks in a
 * section's columns are directly selectable/draggable in the main canvas; a `columns`/
 * `tabs` block's own inner content is edited through that block's style-panel fields
 * instead (see BlockStylePanel.tsx), not the canvas's drag system. */
function renderBlockContent(block: Block, ctx: RenderContext): ReactNode {
  const style = styleToCss(block.style);
  switch (block.kind) {
    case "header":
      return (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            position: block.sticky ? "sticky" : undefined,
            top: block.sticky ? 0 : undefined,
            zIndex: block.sticky ? 10 : undefined,
            backgroundColor: block.style?.backgroundColor ?? "#ffffff",
            ...style,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {block.logoMediaId && (
              <img
                src={ctx.resolveMediaUrl(block.logoMediaId)}
                alt=""
                style={{ height: 32 }}
              />
            )}
            {block.logoText && (
              <span style={{ fontWeight: 700, fontSize: 18 }}>
                {block.logoText}
              </span>
            )}
          </div>
          <nav style={{ display: "flex", gap: 20 }}>
            <NavLinks items={block.navItems} ctx={ctx} />
          </nav>
        </header>
      );

    case "hero":
      return (
        <section
          style={{
            position: "relative",
            padding: "80px 24px",
            textAlign: block.align ?? "center",
            backgroundColor: block.style?.backgroundColor ?? "#f8f9fa",
            backgroundImage: block.backgroundMediaId
              ? `url(${ctx.resolveMediaUrl(block.backgroundMediaId)})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            ...style,
          }}
        >
          <h1 style={{ fontSize: 40, fontWeight: 700, margin: "0 0 16px" }}>
            {block.heading}
          </h1>
          {block.subheading && (
            <p style={{ fontSize: 18, opacity: 0.85, margin: "0 0 24px" }}>
              {block.subheading}
            </p>
          )}
          {block.ctaLabel && (
            <a
              href={ctx.resolveInternalLink(
                block.ctaTargetPageId,
                block.ctaUrl,
              )}
              style={ctaButtonStyle("solid")}
            >
              {block.ctaLabel}
            </a>
          )}
        </section>
      );

    case "footer":
      return (
        <footer
          style={{
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            backgroundColor: block.style?.backgroundColor ?? "#111827",
            color: block.style?.textColor ?? "#ffffff",
            ...style,
          }}
        >
          <nav style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <NavLinks items={block.navItems} ctx={ctx} />
          </nav>
          {block.socialLinks && block.socialLinks.length > 0 && (
            <div style={{ display: "flex", gap: 12 }}>
              {block.socialLinks.map((link, i) => {
                const Icon = SOCIAL_ICON_BY_PLATFORM[link.platform];
                return (
                  <a key={i} href={link.url} style={{ color: "inherit" }}>
                    <Icon style={{ width: 18, height: 18 }} />
                  </a>
                );
              })}
            </div>
          )}
          {block.text && (
            <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>
              {block.text}
            </p>
          )}
        </footer>
      );

    case "columns":
      return (
        <div style={{ display: "flex", gap: 16, ...style }}>
          {block.columns.map((col) => (
            <div
              key={col.id}
              style={{
                flexBasis: `${col.widthFraction * 100}%`,
                flexGrow: 0,
                minWidth: 0,
              }}
            >
              {col.blocks.map((b) => (
                <div key={b.id}>{renderBlockContent(b, ctx)}</div>
              ))}
            </div>
          ))}
        </div>
      );

    case "spacerDivider":
      if (block.variant === "spacer")
        return <div style={{ height: block.height ?? 40 }} />;
      return (
        <hr
          style={{
            border: "none",
            borderTop: `${block.lineThickness ?? 1}px ${block.lineStyle ?? "solid"} ${block.lineColor ?? "#dadce0"}`,
            margin: `${block.height ?? 20}px 0`,
          }}
        />
      );

    case "richText":
      return (
        <div
          style={{ lineHeight: 1.6, ...style }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(block.html) }}
        />
      );

    case "heading": {
      const Tag = `h${block.level}` as unknown as "h1" | "h2" | "h3" | "h4";
      return <Tag style={{ margin: "0 0 12px", ...style }}>{block.text}</Tag>;
    }

    case "image": {
      const img = block.mediaId ? (
        <img
          src={ctx.resolveMediaUrl(block.mediaId)}
          alt={block.alt ?? ""}
          style={{ maxWidth: "100%", display: "block", ...style }}
        />
      ) : (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "#9ca3af",
            border: "1px dashed #dadce0",
          }}
        >
          No image selected
        </div>
      );
      return block.linkUrl ? <a href={block.linkUrl}>{img}</a> : img;
    }

    case "gallery":
      return (
        <div
          style={{
            display: block.layout === "carousel" ? "flex" : "grid",
            gridTemplateColumns:
              block.layout === "grid"
                ? `repeat(${block.columns ?? 3}, 1fr)`
                : undefined,
            overflowX: block.layout === "carousel" ? "auto" : undefined,
            gap: 8,
            ...style,
          }}
        >
          {block.mediaIds.map((id) => (
            <img
              key={id}
              src={ctx.resolveMediaUrl(id)}
              alt=""
              style={{
                width: block.layout === "carousel" ? 240 : "100%",
                flexShrink: 0,
                objectFit: "cover",
                aspectRatio: "4/3",
              }}
            />
          ))}
        </div>
      );

    case "video":
      if (block.mediaId)
        return (
          <video
            src={ctx.resolveMediaUrl(block.mediaId)}
            poster={block.poster}
            controls={block.controls ?? true}
            autoPlay={block.autoplay}
            loop={block.loop}
            style={{ width: "100%", ...style }}
          />
        );
      if (block.embedUrl)
        return (
          <iframe
            src={block.embedUrl}
            style={{
              width: "100%",
              aspectRatio: "16/9",
              border: "none",
              ...style,
            }}
            allowFullScreen
          />
        );
      return (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "#9ca3af",
            border: "1px dashed #dadce0",
          }}
        >
          No video selected
        </div>
      );

    case "button":
      return (
        <a
          href={ctx.resolveInternalLink(block.targetPageId, block.url)}
          style={{ ...ctaButtonStyle(block.variant), ...style }}
        >
          {block.label}
        </a>
      );

    case "icon": {
      const Icon = BUILDER_ICONS[block.iconName] ?? BUILDER_ICONS.star;
      return (
        <Icon
          style={{
            width: block.size ?? 32,
            height: block.size ?? 32,
            ...style,
          }}
        />
      );
    }

    case "iconList":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${block.columns ?? 3}, 1fr)`,
            gap: 20,
            ...style,
          }}
        >
          {block.items.map((item, i) => {
            const Icon = BUILDER_ICONS[item.iconName] ?? BUILDER_ICONS.star;
            return (
              <div key={i}>
                <Icon style={{ width: 28, height: 28, marginBottom: 8 }} />
                <h4 style={{ margin: "0 0 4px", fontSize: 15 }}>
                  {item.title}
                </h4>
                {item.description && (
                  <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );

    case "testimonial":
      return (
        <figure
          style={{
            textAlign: "center",
            maxWidth: 560,
            margin: "0 auto",
            ...style,
          }}
        >
          <blockquote
            style={{ fontSize: 18, fontStyle: "italic", margin: "0 0 16px" }}
          >
            “{block.quote}”
          </blockquote>
          <figcaption
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {block.authorAvatarMediaId && (
              <img
                src={ctx.resolveMediaUrl(block.authorAvatarMediaId)}
                alt=""
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            )}
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {block.authorName}
            </span>
            {block.authorRole && (
              <span style={{ fontSize: 13, opacity: 0.7 }}>
                {block.authorRole}
              </span>
            )}
          </figcaption>
        </figure>
      );

    case "pricingTable":
      return (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "center",
            ...style,
          }}
        >
          {block.plans.map((plan, i) => (
            <div
              key={i}
              style={{
                flex: "1 1 220px",
                maxWidth: 280,
                padding: 24,
                borderRadius: 12,
                border: plan.highlighted
                  ? "2px solid #1a73e8"
                  : "1px solid #dadce0",
              }}
            >
              <h4 style={{ margin: "0 0 8px" }}>{plan.name}</h4>
              <p style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>
                {plan.price}
                {plan.period && (
                  <span style={{ fontSize: 14, fontWeight: 400 }}>
                    {plan.period}
                  </span>
                )}
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "16px 0",
                  fontSize: 13,
                }}
              >
                {plan.features.map((f, j) => (
                  <li key={j} style={{ padding: "4px 0" }}>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.ctaLabel && (
                <a
                  href={plan.ctaUrl ?? "#"}
                  style={ctaButtonStyle(plan.highlighted ? "solid" : "outline")}
                >
                  {plan.ctaLabel}
                </a>
              )}
            </div>
          ))}
        </div>
      );

    case "faq":
      return (
        <div style={{ maxWidth: 640, margin: "0 auto", ...style }}>
          {block.items.map((item, i) => (
            <details
              key={i}
              style={{ padding: "12px 0", borderBottom: "1px solid #dadce0" }}
            >
              <summary style={{ fontWeight: 600, cursor: "pointer" }}>
                {item.question}
              </summary>
              <p style={{ margin: "8px 0 0", fontSize: 14, opacity: 0.85 }}>
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      );

    case "team":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${block.columns ?? 3}, 1fr)`,
            gap: 20,
            ...style,
          }}
        >
          {block.members.map((m, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              {m.photoMediaId ? (
                <img
                  src={ctx.resolveMediaUrl(m.photoMediaId)}
                  alt=""
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: "50%",
                    objectFit: "cover",
                    margin: "0 auto 12px",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: "50%",
                    backgroundColor: "#e5e7eb",
                    margin: "0 auto 12px",
                  }}
                />
              )}
              <h4 style={{ margin: "0 0 2px", fontSize: 15 }}>{m.name}</h4>
              {m.role && (
                <p style={{ margin: "0 0 4px", fontSize: 13, opacity: 0.7 }}>
                  {m.role}
                </p>
              )}
              {m.bio && (
                <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>{m.bio}</p>
              )}
            </div>
          ))}
        </div>
      );

    case "stats":
      return (
        <div
          style={{
            display: "flex",
            gap: 32,
            justifyContent: "center",
            flexWrap: "wrap",
            ...style,
          }}
        >
          {block.items.map((item, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{item.value}</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>{item.label}</div>
            </div>
          ))}
        </div>
      );

    case "socialLinks":
      return (
        <div style={{ display: "flex", gap: 14, ...style }}>
          {block.links.map((link, i) => {
            const Icon = SOCIAL_ICON_BY_PLATFORM[link.platform];
            return (
              <a key={i} href={link.url} style={{ color: "inherit" }}>
                <Icon style={{ width: 22, height: 22 }} />
              </a>
            );
          })}
        </div>
      );

    case "map":
      return (
        <iframe
          src={
            block.embedUrl ??
            (block.address
              ? `https://maps.google.com/maps?q=${encodeURIComponent(block.address)}&z=${block.zoom ?? 14}&output=embed`
              : undefined)
          }
          style={{ width: "100%", height: 320, border: "none", ...style }}
          loading="lazy"
        />
      );

    case "form":
      return (
        <form
          action={
            block.recipientEmail ? `mailto:${block.recipientEmail}` : undefined
          }
          method="GET"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 480,
            ...style,
          }}
        >
          {block.fields.map((field) => (
            <label
              key={field.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 13,
              }}
            >
              {field.label}
              {field.type === "textarea" ? (
                <textarea
                  name={field.id}
                  required={field.required}
                  rows={4}
                  style={{
                    padding: 8,
                    border: "1px solid #dadce0",
                    borderRadius: 6,
                  }}
                />
              ) : (
                <input
                  type={field.type}
                  name={field.id}
                  required={field.required}
                  style={{
                    padding: 8,
                    border: "1px solid #dadce0",
                    borderRadius: 6,
                  }}
                />
              )}
            </label>
          ))}
          <button
            type="submit"
            style={{
              ...ctaButtonStyle("solid"),
              border: "none",
              alignSelf: "flex-start",
            }}
          >
            {block.submitLabel ?? "Send"}
          </button>
        </form>
      );

    case "countdown": {
      const containerId = `cd-${block.id}`;
      return (
        <div
          id={containerId}
          data-target={block.targetDate}
          style={{ display: "flex", gap: 16, ...style }}
        >
          {(["days", "hours", "mins", "secs"] as const).map((unit) => (
            <div key={unit} style={{ textAlign: "center" }}>
              <div
                className={`cd-${unit}`}
                style={{ fontSize: 28, fontWeight: 700 }}
              >
                --
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.7,
                  textTransform: "uppercase",
                }}
              >
                {unit}
              </div>
            </div>
          ))}
          <script
            dangerouslySetInnerHTML={{ __html: countdownScript(containerId) }}
          />
        </div>
      );
    }

    case "tabs": {
      const groupName = `tabs-${block.id}`;
      const rules = block.tabs
        .map(
          (_, i) =>
            `#${groupName}-${i}:checked ~ .${groupName}-panels .${groupName}-panel-${i}{display:block;}`,
        )
        .join("\n");
      return (
        <div style={style}>
          {block.tabs.map((_, i) => (
            <input
              key={i}
              type="radio"
              name={groupName}
              id={`${groupName}-${i}`}
              defaultChecked={i === 0}
              style={{ display: "none" }}
            />
          ))}
          <style
            dangerouslySetInnerHTML={{
              __html: `${rules}\n.${groupName}-panel{display:none;}`,
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 8,
              borderBottom: "1px solid #dadce0",
              marginBottom: 16,
            }}
          >
            {block.tabs.map((tab, i) => (
              <label
                key={i}
                htmlFor={`${groupName}-${i}`}
                style={{
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {tab.label}
              </label>
            ))}
          </div>
          <div className={`${groupName}-panels`}>
            {block.tabs.map((tab, i) => (
              <div
                key={i}
                className={`${groupName}-panel ${groupName}-panel-${i}`}
              >
                {tab.blocks.map((b) => (
                  <div key={b.id}>{renderBlockContent(b, ctx)}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "customHtml":
      return (
        <iframe
          sandbox="allow-scripts allow-same-origin"
          srcDoc={`<!doctype html><html><head><style>${block.css}</style></head><body>${block.html}</body></html>`}
          style={{
            width: "100%",
            height: block.height ?? 300,
            border: "none",
            ...style,
          }}
        />
      );
  }
}

function renderBlock(
  block: Block,
  ctx: RenderContext,
  location: { sectionId: string; columnId: string } | null,
  interactive: InteractiveProps | undefined,
): ReactNode {
  const content = renderBlockContent(block, ctx);
  if (!interactive || !location) {
    return <div key={block.id}>{content}</div>;
  }

  const isSelected =
    interactive.selected?.scope === "block" &&
    interactive.selected.blockId === block.id;

  return (
    <div
      key={block.id}
      data-block-id={block.id}
      className={selectableClass(isSelected)}
      onPointerDown={(e) =>
        interactive.onBlockPointerDown(
          e,
          location.sectionId,
          location.columnId,
          block.id,
        )
      }
      onClick={(e) => {
        e.stopPropagation();
        interactive.onSelect({
          scope: "block",
          sectionId: location.sectionId,
          columnId: location.columnId,
          blockId: block.id,
        });
      }}
    >
      {content}
    </div>
  );
}

function renderSection(
  section: Section,
  ctx: RenderContext,
  interactive: InteractiveProps | undefined,
): ReactNode {
  const isSectionSelected =
    interactive?.selected?.scope === "section" &&
    interactive.selected.sectionId === section.id;

  return (
    <section
      key={section.id}
      style={{
        display: "flex",
        gap: 16,
        maxWidth: section.fullBleed ? undefined : 1200,
        margin: section.fullBleed ? undefined : "0 auto",
        ...styleToCss(section.style),
      }}
      className={interactive ? selectableClass(isSectionSelected) : undefined}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              interactive.onSelect({ scope: "section", sectionId: section.id });
            }
          : undefined
      }
    >
      {section.columns.map((col) => {
        const isColSelected =
          interactive?.selected?.scope === "column" &&
          interactive.selected.sectionId === section.id &&
          interactive.selected.columnId === col.id;
        return (
          <div
            key={col.id}
            ref={
              interactive
                ? (el) => interactive.registerColumnEl(section.id, col.id, el)
                : undefined
            }
            data-column-id={col.id}
            style={{
              flexBasis: `${col.widthFraction * 100}%`,
              flexGrow: 0,
              minWidth: 0,
              minHeight: 40,
              ...styleToCss(col.style),
            }}
            className={interactive ? selectableClass(isColSelected) : undefined}
            onClick={
              interactive
                ? (e) => {
                    e.stopPropagation();
                    interactive.onSelect({
                      scope: "column",
                      sectionId: section.id,
                      columnId: col.id,
                    });
                  }
                : undefined
            }
          >
            {col.blocks.map((block) =>
              renderBlock(
                block,
                ctx,
                { sectionId: section.id, columnId: col.id },
                interactive,
              ),
            )}
          </div>
        );
      })}
    </section>
  );
}

/** The one component that renders a page's header/hero/sections/footer — used
 * identically by the editing canvas (`interactive` set), the live preview iframe, and
 * the zip-export HTML generator (via renderToStaticMarkup), so editor/preview/export
 * can never visually disagree. Every visual property is a plain inline style; Tailwind
 * classes appear only for editor-only selection chrome, which is absent whenever
 * `interactive` is omitted. */
export function WebsitePageBlocks({ page, ctx, interactive }: Props) {
  const isHeaderSelected =
    interactive?.selected?.scope === "slot" &&
    interactive.selected.slot === "header";
  const isHeroSelected =
    interactive?.selected?.scope === "slot" &&
    interactive.selected.slot === "hero";
  const isFooterSelected =
    interactive?.selected?.scope === "slot" &&
    interactive.selected.slot === "footer";

  const slotButtonClass =
    "flex w-full items-center justify-center py-3 text-xs font-medium text-neutral-400 ring-1 ring-dashed ring-neutral-300 transition hover:text-accent hover:ring-accent/40";

  return (
    <div>
      {page.header ? (
        <div
          className={
            interactive ? selectableClass(isHeaderSelected) : undefined
          }
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  interactive.onSelect({ scope: "slot", slot: "header" });
                }
              : undefined
          }
        >
          {renderBlockContent(page.header, ctx)}
        </div>
      ) : (
        interactive && (
          <button
            type="button"
            className={slotButtonClass}
            onClick={() => interactive.onAddSlotBlock("header")}
          >
            + Add header
          </button>
        )
      )}
      {page.hero ? (
        <div
          className={interactive ? selectableClass(isHeroSelected) : undefined}
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  interactive.onSelect({ scope: "slot", slot: "hero" });
                }
              : undefined
          }
        >
          {renderBlockContent(page.hero, ctx)}
        </div>
      ) : (
        interactive && (
          <button
            type="button"
            className={slotButtonClass}
            onClick={() => interactive.onAddSlotBlock("hero")}
          >
            + Add hero
          </button>
        )
      )}
      {[...page.sections]
        .sort((a, b) => a.index - b.index)
        .map((section) => renderSection(section, ctx, interactive))}
      {page.footer ? (
        <div
          className={
            interactive ? selectableClass(isFooterSelected) : undefined
          }
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  interactive.onSelect({ scope: "slot", slot: "footer" });
                }
              : undefined
          }
        >
          {renderBlockContent(page.footer, ctx)}
        </div>
      ) : (
        interactive && (
          <button
            type="button"
            className={slotButtonClass}
            onClick={() => interactive.onAddSlotBlock("footer")}
          >
            + Add footer
          </button>
        )
      )}
    </div>
  );
}
