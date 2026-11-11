import type { EditorBand } from "@/types/editor";
import { SliderRow } from "@/components/SliderRow";

interface BandPropertiesPanelProps {
  label: string;
  band: EditorBand;
  /** Side sections are sized by width, the rest by height. */
  vertical?: boolean;
  onChange: (band: EditorBand) => void;
  onReset: () => void;
}

const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Sans", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Mono", value: "monospace" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Script", value: "cursive" },
];

const ALIGNS: EditorBand["align"][] = ["left", "center", "right"];

const toggleClass = (active: boolean) =>
  `rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
    active
      ? "bg-neutral-900 text-white"
      : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
  }`;

/** Right-panel settings for a section (header, footer, sides...), shown when it's selected in the left tree. */
export function BandPropertiesPanel({
  label,
  band,
  vertical = false,
  onChange,
  onReset,
}: BandPropertiesPanelProps) {
  const patch = (changes: Partial<EditorBand>) =>
    onChange({ ...band, ...changes });

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">{label}</h3>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-neutral-400 transition hover:text-neutral-700"
        >
          Reset
        </button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Text
        <input
          value={band.text}
          onChange={(e) => patch({ text: e.target.value })}
          placeholder={`${label} text`}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-800 outline-none focus:border-accent"
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-xs text-neutral-500">
        Font
        <select
          value={band.fontFamily}
          onChange={(e) => patch({ fontFamily: e.target.value })}
          className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-800 outline-none focus:border-accent"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={band.bold}
          onClick={() => patch({ bold: !band.bold })}
          className={`${toggleClass(band.bold)} font-bold`}
        >
          B
        </button>
        <button
          type="button"
          aria-pressed={band.italic}
          onClick={() => patch({ italic: !band.italic })}
          className={`${toggleClass(band.italic)} italic`}
        >
          I
        </button>
        <button
          type="button"
          aria-pressed={band.uppercase}
          onClick={() => patch({ uppercase: !band.uppercase })}
          className={toggleClass(band.uppercase)}
        >
          AA
        </button>
        <span className="mx-1 w-px self-stretch bg-neutral-200" />
        {ALIGNS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={band.align === a}
            onClick={() => patch({ align: a })}
            className={`${toggleClass(band.align === a)} capitalize`}
          >
            {a}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between text-xs text-neutral-500">
        Fill color
        <input
          type="color"
          value={band.background}
          onChange={(e) => patch({ background: e.target.value })}
          className="size-7 cursor-pointer rounded border border-neutral-300"
        />
      </label>
      <label className="flex items-center justify-between text-xs text-neutral-500">
        Text color
        <input
          type="color"
          value={band.color}
          onChange={(e) => patch({ color: e.target.value })}
          className="size-7 cursor-pointer rounded border border-neutral-300"
        />
      </label>
      <SliderRow
        label={vertical ? "Width" : "Height"}
        min={40}
        max={240}
        unit="px"
        value={band.size}
        onChange={(v) => patch({ size: v })}
      />
      <SliderRow
        label="Text size"
        min={14}
        max={80}
        unit="px"
        value={band.fontSize}
        onChange={(v) => patch({ fontSize: v })}
      />
      <SliderRow
        label="Opacity"
        min={10}
        max={100}
        step={5}
        unit="%"
        value={Math.round(band.opacity * 100)}
        onChange={(v) => patch({ opacity: v / 100 })}
      />
      <SliderRow
        label="Border"
        min={0}
        max={16}
        unit="px"
        value={band.borderWidth}
        onChange={(v) => patch({ borderWidth: v })}
      />
      {band.borderWidth > 0 && (
        <label className="flex items-center justify-between text-xs text-neutral-500">
          Border color
          <input
            type="color"
            value={band.borderColor}
            onChange={(e) => patch({ borderColor: e.target.value })}
            className="size-7 cursor-pointer rounded border border-neutral-300"
          />
        </label>
      )}
    </div>
  );
}
