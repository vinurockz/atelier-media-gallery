export type BlockKind =
  | "header"
  | "hero"
  | "footer"
  | "columns"
  | "spacerDivider"
  | "richText"
  | "heading"
  | "image"
  | "gallery"
  | "video"
  | "button"
  | "icon"
  | "iconList"
  | "testimonial"
  | "pricingTable"
  | "faq"
  | "team"
  | "stats"
  | "socialLinks"
  | "map"
  | "form"
  | "countdown"
  | "tabs"
  | "customHtml";

export interface SocialLink {
  platform:
    | "twitter"
    | "facebook"
    | "instagram"
    | "linkedin"
    | "youtube"
    | "tiktok"
    | "other";
  url: string;
}

export interface NavItem {
  label: string;
  targetPageId: string | null;
  url?: string;
}

/**
 * All-optional, defaulted with `??` at the point of render rather than assumed
 * present — same convention as BookElement's optional crop/shapeKind/fillColor
 * fields, since the server stores whatever shape the client sends. Shared by
 * blocks, columns, and sections so one style panel/type covers all three.
 */
export interface BlockStyle {
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  marginTop?: number;
  marginBottom?: number;
  backgroundColor?: string;
  backgroundImageMediaId?: string | null;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  textAlign?: "left" | "center" | "right";
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  maxWidth?: number;
  opacity?: number;
}

interface BlockBase {
  id: string;
  style?: BlockStyle;
}

export type Block =
  | (BlockBase & {
      kind: "header";
      logoText?: string;
      logoMediaId?: string | null;
      navItems: NavItem[];
      sticky?: boolean;
    })
  | (BlockBase & {
      kind: "hero";
      heading: string;
      subheading?: string;
      backgroundMediaId?: string | null;
      ctaLabel?: string;
      ctaUrl?: string;
      ctaTargetPageId?: string | null;
      align?: "left" | "center" | "right";
    })
  | (BlockBase & {
      kind: "footer";
      text?: string;
      navItems: NavItem[];
      socialLinks?: SocialLink[];
    })
  | (BlockBase & {
      kind: "columns";
      columns: { id: string; widthFraction: number; blocks: Block[] }[];
    })
  | (BlockBase & {
      kind: "spacerDivider";
      variant: "spacer" | "divider";
      height?: number;
      lineColor?: string;
      lineThickness?: number;
      lineStyle?: "solid" | "dashed" | "dotted";
    })
  | (BlockBase & { kind: "richText"; html: string })
  | (BlockBase & { kind: "heading"; text: string; level: 1 | 2 | 3 | 4 })
  | (BlockBase & {
      kind: "image";
      mediaId: string | null;
      alt?: string;
      linkUrl?: string;
    })
  | (BlockBase & {
      kind: "gallery";
      mediaIds: string[];
      layout: "grid" | "carousel";
      columns?: number;
    })
  | (BlockBase & {
      kind: "video";
      mediaId: string | null;
      embedUrl?: string;
      poster?: string;
      autoplay?: boolean;
      loop?: boolean;
      controls?: boolean;
    })
  | (BlockBase & {
      kind: "button";
      label: string;
      url?: string;
      targetPageId?: string | null;
      variant: "solid" | "outline" | "ghost";
    })
  | (BlockBase & { kind: "icon"; iconName: string; size?: number })
  | (BlockBase & {
      kind: "iconList";
      items: { iconName: string; title: string; description?: string }[];
      columns?: number;
    })
  | (BlockBase & {
      kind: "testimonial";
      quote: string;
      authorName: string;
      authorRole?: string;
      authorAvatarMediaId?: string | null;
      rating?: number;
    })
  | (BlockBase & {
      kind: "pricingTable";
      plans: {
        name: string;
        price: string;
        period?: string;
        features: string[];
        ctaLabel?: string;
        ctaUrl?: string;
        highlighted?: boolean;
      }[];
    })
  | (BlockBase & {
      kind: "faq";
      items: { question: string; answer: string }[];
    })
  | (BlockBase & {
      kind: "team";
      members: {
        name: string;
        role?: string;
        photoMediaId?: string | null;
        bio?: string;
      }[];
      columns?: number;
    })
  | (BlockBase & {
      kind: "stats";
      items: { value: string; label: string }[];
    })
  | (BlockBase & { kind: "socialLinks"; links: SocialLink[] })
  | (BlockBase & {
      kind: "map";
      address?: string;
      embedUrl?: string;
      zoom?: number;
    })
  | (BlockBase & {
      kind: "form";
      fields: {
        id: string;
        label: string;
        type: "text" | "email" | "textarea" | "tel";
        required?: boolean;
      }[];
      submitLabel?: string;
      recipientEmail?: string;
    })
  | (BlockBase & { kind: "countdown"; targetDate: string })
  | (BlockBase & {
      kind: "tabs";
      tabs: { label: string; blocks: Block[] }[];
    })
  | (BlockBase & {
      kind: "customHtml";
      html: string;
      css: string;
      height?: number;
    });

export interface Column {
  id: string;
  widthFraction: number;
  blocks: Block[];
  style?: BlockStyle;
}

export interface Section {
  id: string;
  index: number;
  style?: BlockStyle;
  fullBleed?: boolean;
  columns: Column[];
}

export interface SitePage {
  id: string;
  siteId: string;
  index: number;
  title: string;
  slug: string;
  header: Block | null;
  hero: Block | null;
  sections: Section[];
  footer: Block | null;
  seoDescription?: string;
}

export interface Site {
  id: string;
  name: string;
  faviconMediaId?: string | null;
  themeColor?: string;
  pageCount: number;
  createdAt: number;
  updatedAt: number;
}
