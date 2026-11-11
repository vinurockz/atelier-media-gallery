import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type SVGProps,
} from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}

/** A Drive-style right-click popup, positioned at the cursor and clamped to the viewport. */
export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const style = useMemo(() => {
    const maxX = Math.max(8, window.innerWidth - 240);
    const maxY = Math.max(8, window.innerHeight - 260);
    return { left: Math.min(x, maxX), top: Math.min(y, maxY) };
  }, [x, y]);

  return (
    <div
      ref={ref}
      role="menu"
      style={style}
      className="fixed z-50 w-56 overflow-hidden rounded-lg border border-linen bg-surface py-1 shadow-lifted"
    >
      {children}
    </div>
  );
}

interface ContextMenuButtonProps {
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export function ContextMenuButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: ContextMenuButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-linen-hover ${
        danger ? "text-red-600" : "text-ink"
      }`}
    >
      <Icon
        className={`size-4 shrink-0 ${danger ? "text-red-500" : "text-stone"}`}
      />
      {label}
    </button>
  );
}

export function ContextMenuDivider() {
  return <div className="my-1 border-t border-linen" />;
}
