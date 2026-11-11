import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { BoldIcon, ItalicIcon } from "@/components/icons";

type Props = {
  html: string;
  onChange: (html: string) => void;
};

const ALLOWED_TAGS = ["b", "strong", "i", "em", "font", "br", "div", "span"];

/** `size` is the only attribute a legacy execCommand("fontSize") run can produce — see
 * the "A"/"A+"/"A++" buttons below. */
function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ["size"] });
}

const sizeButton =
  "flex h-6 min-w-6 items-center justify-center rounded px-1 text-[11px] font-semibold text-neutral-600 transition hover:bg-black/5";

/**
 * One sentence's editable text — bold/italic/size via `execCommand`, no editor dependency,
 * same pattern as NoteTextBlock. Uncontrolled on purpose: seeding innerHTML from `html` on
 * every render would reset the caret mid-edit, so it's only seeded once on mount.
 */
export function SentenceTextBlock({ html, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const initialHtml = useRef(html);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitize(initialHtml.current);
    // Seed once on mount only — see the doc comment above.
  }, []);

  const handleInput = () => {
    if (ref.current) onChange(sanitize(ref.current.innerHTML));
  };

  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  };

  return (
    <div className="rounded-2xl">
      <div className="mb-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          aria-label="Bold"
          className="flex size-6 items-center justify-center rounded text-neutral-600 transition hover:bg-black/5"
        >
          <BoldIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("italic")}
          aria-label="Italic"
          className="flex size-6 items-center justify-center rounded text-neutral-600 transition hover:bg-black/5"
        >
          <ItalicIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("fontSize", "3")}
          aria-label="Normal text size"
          title="Normal size"
          className={`${sizeButton} text-[11px]`}
        >
          A
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("fontSize", "5")}
          aria-label="Increase text size"
          title="Larger"
          className={`${sizeButton} text-[13px]`}
        >
          A+
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("fontSize", "7")}
          aria-label="Increase text size more"
          title="Largest"
          className={`${sizeButton} text-[15px]`}
        >
          A++
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Sentence text"
        onInput={handleInput}
        onBlur={handleInput}
        className="min-h-6 px-1 text-sm text-ink outline-none"
      />
    </div>
  );
}
