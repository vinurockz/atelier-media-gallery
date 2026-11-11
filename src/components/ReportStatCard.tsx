type Props = {
  label: string;
  value: string | number;
  hint?: string;
};

/** One stat tile — reused across every report panel so the numbers all read consistently. */
export function ReportStatCard({ label, value, hint }: Props) {
  return (
    <div className="rounded-lg border border-linen bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-stone">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone">{hint}</div>}
    </div>
  );
}
