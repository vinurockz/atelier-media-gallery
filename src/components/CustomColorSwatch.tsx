type Props = {
  onChange: (color: string) => void;
  size?: string;
};

/** The "pick any color" swatch dropped at the end of every preset color row in the app —
 * a rainbow dot with a native `<input type="color">` invisibly overlaid, so clicking it
 * opens the browser/OS color picker instead of only offering the fixed presets. */
export function CustomColorSwatch({ onChange, size = "size-5" }: Props) {
  return (
    <label
      title="Custom color"
      className={`relative flex ${size} shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-black/10`}
      style={{
        background:
          "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
      }}
    >
      <input
        type="color"
        onChange={(e) => onChange(e.target.value)}
        aria-label="Custom color"
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}
