import type { SVGProps } from "react";

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function PauseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M7 5v14M17 5v14" />
    </Svg>
  );
}

export function ExpandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </Svg>
  );
}

export function CollapseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 3v4a2 2 0 0 1-2 2H3M15 3v4a2 2 0 0 0 2 2h4M9 21v-4a2 2 0 0 0-2-2H3M15 21v-4a2 2 0 0 1 2-2h4" />
    </Svg>
  );
}

export function PipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect
        x="12"
        y="12"
        width="7"
        height="5"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function ImageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="m21 15-5-5-9 9" />
    </Svg>
  );
}

export function FilmIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </Svg>
  );
}

export function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </Svg>
  );
}

export function FolderPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M12 11v4M10 13h4" />
    </Svg>
  );
}

export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M5 12l5 5L20 7" />
    </Svg>
  );
}

export function KebabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </Svg>
  );
}

export function FolderInputIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M8 12h7M12 9l3 3-3 3" />
    </Svg>
  );
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </Svg>
  );
}

export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 21V9M7 14l5-5 5 5M5 3h14" />
    </Svg>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </Svg>
  );
}

export function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Svg>
  );
}

export function ListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </Svg>
  );
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
    </Svg>
  );
}

export function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </Svg>
  );
}

export function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </Svg>
  );
}

export function AttachIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="m21.44 11.05-9.19 9.19a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48" />
    </Svg>
  );
}

export function ScissorsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.5 8.5 20 20M20 4 8.5 15.5" />
    </Svg>
  );
}

export function TextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M12 6v14M9 20h6" />
    </Svg>
  );
}

export function RotateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 1 3 6.7" />
      <path d="M3 18v-5h5" />
    </Svg>
  );
}

export function RectShapeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="4" y="6" width="16" height="12" rx="1" />
    </Svg>
  );
}

export function CircleShapeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
    </Svg>
  );
}

export function LineShapeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M5 19 19 5" />
    </Svg>
  );
}

export function EyedropperIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="m2 22 1-5 9-9" />
      <path d="m12 8 4 4" />
      <path d="M17.5 2.5a2.12 2.12 0 0 1 3 3L16 10l-3-3Z" />
    </Svg>
  );
}

export function CropIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </Svg>
  );
}

export function LassoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path
        d="M11 3c-4.4 0-8 2.9-8 6.5S6.6 16 11 16c1.1 0 2.1-.2 3-.5"
        strokeDasharray="2.5 2.5"
      />
      <path d="M13.5 14.5c1.3.6 2.2 1.7 2.2 2.8a2.8 2.8 0 1 1-5.5 0c0-.9.5-1.6 1.1-2.3" />
    </Svg>
  );
}

export function UndoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 10h10a5 5 0 0 1 0 10H8" />
      <path d="M8 15 3 10l5-5" />
    </Svg>
  );
}

export function RedoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M21 10H11a5 5 0 0 0 0 10h5" />
      <path d="m16 15 5-5-5-5" />
    </Svg>
  );
}

export function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </Svg>
  );
}

export function NoteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M5 3h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v4a1 1 0 0 0 1 1h4" />
      <path d="M7 12h10M7 16h6" />
    </Svg>
  );
}

export function LinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 17H7a5 5 0 0 1 0-10h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8 12h8" />
    </Svg>
  );
}

export function BoldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M7 4h6a3.5 3.5 0 0 1 0 7H7V4Z" />
      <path d="M7 11h7a3.5 3.5 0 0 1 0 7H7v-7Z" />
    </Svg>
  );
}

export function ItalicIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M10 4h7M7 20h7M14 4 10 20" />
    </Svg>
  );
}

export function UnderlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 4v7a6 6 0 0 0 12 0V4" />
      <path d="M5 20h14" />
    </Svg>
  );
}

export function PinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 2v6" />
      <path d="M8 8h8l1 4H7l1-4Z" />
      <path d="M12 12v10" />
    </Svg>
  );
}

export function ReceiptIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 2h12v19l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5Z" />
      <path d="M9 7h6M9 11h6M9 15h3" />
    </Svg>
  );
}

export function TaskBoardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="10" rx="1" />
      <rect x="17" y="4" width="4" height="6" rx="1" />
    </Svg>
  );
}

export function PrinterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" />
      <path d="M6 14h12v7H6Z" />
    </Svg>
  );
}

export function AlignLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 12h10M4 18h13" />
    </Svg>
  );
}

export function AlignCenterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M7 12h10M5.5 18h13" />
    </Svg>
  );
}

export function AlignRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M10 12h10M7 18h13" />
    </Svg>
  );
}

export function IndentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M10 12h10M4 18h16" />
      <path d="m4 10 3 2-3 2" />
    </Svg>
  );
}

export function BookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z" />
      <path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" />
    </Svg>
  );
}

export function PdfIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M15 2v5h5" />
      <path d="M8 17.5v-5h1.3a1.6 1.6 0 0 1 0 3.2H8M12.3 17.5v-5h1a1.7 1.7 0 0 1 0 5h-1ZM16.5 17.5v-5H19M16.5 15h2" />
    </Svg>
  );
}

export function HighlighterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="m9 11 4 4" />
      <path
        d="m5 19 2.5-2.5L5.5 14 3 16.5V19h2Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M14.5 4.5 20 10 11 19l-5.5-5.5 9-9Z" />
    </Svg>
  );
}

export function CameraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </Svg>
  );
}

export function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ClapperboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 9.5 19.5 5l1 4L4 13.5Z" />
      <path d="M4 13.5h16v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="m7.5 8.2 2 3M12.5 7 14.5 10" />
    </Svg>
  );
}

export function LayoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M9 9.5V19.5" />
    </Svg>
  );
}

// Curated glyph set for the Website Builder's icon/iconList/socialLinks/team blocks —
// plain line icons in this file's existing style, not precise brand logos (nothing
// else in this app draws exact brand marks either).

export function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z" />
    </Svg>
  );
}

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </Svg>
  );
}

export function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 20s-7.5-4.6-9.5-9.3C1.2 7.4 3 4.5 6.1 4.2 8.2 4 10.3 5.1 12 7.5c1.7-2.4 3.8-3.5 5.9-3.3 3.1.3 4.9 3.2 3.6 6.5C19.5 15.4 12 20 12 20Z" />
    </Svg>
  );
}

export function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M5 4.5h3.3l1.4 4-2 1.6a12.4 12.4 0 0 0 5.2 5.2l1.6-2 4 1.4V18c0 1.1-.9 2-2 2C9.9 20 4 14.1 4 6.5c0-1.1.9-2 2-2Z" />
    </Svg>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </Svg>
  );
}

export function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 4 5.3 4 8.5s-1.5 6.2-4 8.5c-2.5-2.3-4-5.3-4-8.5s1.5-6.2 4-8.5Z" />
    </Svg>
  );
}

export function TwitterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 4.5l7.1 8.4-6.7 6.6h2.6l5.4-5.3 4.4 5.3H21l-7.4-8.9L19.9 4.5h-2.6l-4.9 4.8-4-4.8Z" />
    </Svg>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M14.5 21v-7h2.3l.4-3h-2.7V9c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.6-.1-1.5-.2-2.4-.2-2.5 0-4.2 1.5-4.2 4.2V11H8.5v3H11v7Z" />
    </Svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="16.8" cy="7.2" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M7.5 10.5v6M7.5 7.8v.1M11 16.5v-3.7c0-1.5 1-2.3 2.2-2.3 1.2 0 1.8.8 1.8 2.3v3.7M11 10.5v6" />
    </Svg>
  );
}

export function YoutubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="3" />
      <path d="M10.5 9.5v5l4.3-2.5Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function TiktokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M13.5 3.5v10.8a2.7 2.7 0 1 1-2.2-2.65" />
      <path d="M13.5 3.5c.3 2 1.8 3.5 3.8 3.7v2.6c-1.4 0-2.7-.4-3.8-1.2" />
    </Svg>
  );
}

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M20.5 12.3c0-.7-.1-1.3-.2-1.9H12v3.6h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.6Z" />
      <path d="M12 21c2.4 0 4.5-.8 5.9-2.1l-2.9-2.2c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21Z" />
      <path d="M7 13.9a5.4 5.4 0 0 1 0-3.8V7.8H4a9 9 0 0 0 0 8.4Z" />
      <path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 7.8l3 2.3c.7-2.1 2.7-3.5 5-3.5Z" />
    </Svg>
  );
}

export function CodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="m9 7-5 5 5 5M15 7l5 5-5 5" />
    </Svg>
  );
}

export function MessagesSquareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M8 4h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1v4l-4-4H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M6 9H4a1 1 0 0 0-1 1v8l3-2.5" />
    </Svg>
  );
}

export function MergeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 3v7a4 4 0 0 0 4 4h4" />
      <path d="M18 3v7a4 4 0 0 1-4 4" />
      <path d="m11 11 3 3-3 3" />
    </Svg>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.8-4.8" />
    </Svg>
  );
}

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  );
}

export function ImagesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="6" width="15" height="13" rx="2" />
      <path d="M6 3h13a2 2 0 0 1 2 2v13" />
      <circle cx="8" cy="11" r="1.4" fill="currentColor" stroke="none" />
      <path d="m4 16 3.5-3.5a1.5 1.5 0 0 1 2.1 0L13 16M12.5 15l1.5-1.5a1.5 1.5 0 0 1 2.1 0l1.4 1.4" />
    </Svg>
  );
}

export function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12.5 16V8M17 16v-7" />
    </Svg>
  );
}

export function PlugIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5Z" />
      <path d="M12 16v5" />
    </Svg>
  );
}
