import { useState } from "react";
import { isDefaultAdjustments, type Adjustments } from "@/lib/canvasDraw";
import { ChevronRightIcon } from "@/components/icons";
import { SliderRow } from "@/components/SliderRow";

interface AdjustmentRow {
  key: keyof Adjustments;
  label: string;
  min: number;
  max: number;
  unit: string;
}

const ADJUSTMENT_ROWS: AdjustmentRow[] = [
  { key: "brightness", label: "Brightness", min: -100, max: 100, unit: "%" },
  { key: "contrast", label: "Contrast", min: -100, max: 100, unit: "%" },
  { key: "saturation", label: "Saturation", min: -100, max: 100, unit: "%" },
  { key: "hue", label: "Hue", min: -180, max: 180, unit: "°" },
  { key: "grayscale", label: "Grayscale", min: 0, max: 100, unit: "%" },
  { key: "sepia", label: "Sepia", min: 0, max: 100, unit: "%" },
  { key: "invert", label: "Invert", min: 0, max: 100, unit: "%" },
  { key: "blur", label: "Blur", min: 0, max: 20, unit: "px" },
  { key: "pixelate", label: "Pixelate", min: 0, max: 40, unit: "px" },
  { key: "vignette", label: "Vignette", min: 0, max: 100, unit: "%" },
];

interface AdjustmentsPanelProps {
  adjustments: Adjustments;
  onChange: (patch: Partial<Adjustments>) => void;
  onReset: () => void;
}

/** Photoshop-style continuous adjustment sliders, shared by the photo and video editors.
 * Collapsed by default once any value has already been changed from default (so reopening the
 * editor on an already-adjusted photo doesn't hide what's active), expanded by default
 * otherwise. */
export function AdjustmentsPanel({
  adjustments,
  onChange,
  onReset,
}: AdjustmentsPanelProps) {
  const [open, setOpen] = useState(() => !isDefaultAdjustments(adjustments));

  return (
    <div className="rounded-lg bg-canvas ring-1 ring-linen">
      <div className="flex items-center justify-between p-3 pb-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone"
        >
          <ChevronRightIcon
            className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          />
          Adjustments
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-accent hover:underline"
        >
          Reset
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-1.5 p-3">
          {ADJUSTMENT_ROWS.map((row) => (
            <SliderRow
              key={row.key}
              label={row.label}
              min={row.min}
              max={row.max}
              unit={row.unit}
              value={adjustments[row.key]}
              onChange={(value) => onChange({ [row.key]: value })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
