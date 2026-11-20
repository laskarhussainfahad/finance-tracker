export default function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <input
      type="month"
      className="input w-auto"
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
    />
  );
}
