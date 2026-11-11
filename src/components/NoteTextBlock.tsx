import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  UnderlineIcon,
} from "@/components/icons";

type Props = {
  html: string;
  onChange: (html: string) => void;
  autoFocus?: boolean;
};

const ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "br",
  "div",
  "span",
  "p",
];

/** Sanitized right before it's stored or rendered — defense in depth even though the
 * only writer is this same contentEditable. */
function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}

/**
 * A note's rich-text block — bold/italic/underline/bulleted-list via `execCommand`,
 * no editor dependency. The contentEditable div is intentionally uncontrolled: seeding
 * its innerHTML from `html` on every render would reset the caret mid-sentence, so it's
 * only seeded once, when this block instance first mounts (give it a `key` per block id
 * from the caller if a fresh block needs a fresh seed).
 */
export function NoteTextBlock({ html, onChange, autoFocus }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const initialHtml = useRef(html);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitize(initialHtml.current);
    if (autoFocus) ref.current?.focus();
    // Seed once on mount only — see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = () => {
    if (ref.current) onChange(sanitize(ref.current.innerHTML));
  };

  const exec = (command: string) => {
    ref.current?.focus();
    document.execCommand(command);
    handleInput();
  };

  const toolbarButton = (
    label: string,
    command: string,
    Icon: typeof BoldIcon,
  ) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => exec(command)}
      aria-label={label}
      className="flex size-6 items-center justify-center rounded text-neutral-600 transition hover:bg-black/5"
    >
      <Icon className="size-3.5" />
    </button>
  );

  return (
    <div className="rounded-md bg-white/70 ring-1 ring-black/5">
      <div className="flex items-center gap-0.5 border-b border-black/5 px-1 py-1">
        {toolbarButton("Bold", "bold", BoldIcon)}
        {toolbarButton("Italic", "italic", ItalicIcon)}
        {toolbarButton("Underline", "underline", UnderlineIcon)}
        {toolbarButton("Bulleted list", "insertUnorderedList", ListIcon)}
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Note text"
        onInput={handleInput}
        onBlur={handleInput}
        className="min-h-10 px-2.5 py-2 text-sm text-ink outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
    </div>
  );
}
