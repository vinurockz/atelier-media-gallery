import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** The native <dialog> element gives focus trapping and Escape-to-close for free. */
export function TeamsDialog({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(26rem,92vw)] rounded-xl border border-linen bg-surface p-5 text-ink shadow-lifted backdrop:bg-ink/40"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="truncate font-serif text-lg">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md px-2 py-1 text-stone hover:bg-linen-hover"
        >
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
