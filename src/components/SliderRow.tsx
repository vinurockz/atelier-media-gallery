interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

/** Label + slider + numeric readout, in one row — the pattern used throughout the editor's panels. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: SliderRowProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <span className="w-[72px] shrink-0 truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1"
      />
      <span className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-300 px-1.5 py-1">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isNaN(next))
              onChange(Math.min(max, Math.max(min, next)));
          }}
          className="w-9 text-right text-xs text-neutral-800 outline-none"
        />
        {unit && <span className="text-neutral-400">{unit}</span>}
      </span>
    </div>
  );
}
