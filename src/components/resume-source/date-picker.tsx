"use client";

import { Label } from "@/components/ui/label";

const MONTHS = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 60 }, (_, i) => currentYear - i + 5);

type DatePickerProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  showPresent?: boolean;
  isPresent?: boolean;
  onPresentChange?: (present: boolean) => void;
};

export function DatePicker({
  label,
  value,
  onChange,
  showPresent,
  isPresent,
  onPresentChange,
}: DatePickerProps) {
  const month = value?.split("-")[1] ?? "";
  const year = value?.split("-")[0] ?? "";

  const handleMonthChange = (m: string) => {
    if (!m) {
      if (!year) onChange(null);
      return;
    }
    onChange(`${year || currentYear}-${m}`);
  };

  const handleYearChange = (y: string) => {
    if (!y) {
      if (!month) onChange(null);
      return;
    }
    onChange(`${y}-${month || "01"}`);
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        {showPresent && (
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={isPresent}
              onChange={(e) => onPresentChange?.(e.target.checked)}
              className="rounded"
            />
            Present
          </label>
        )}
        {!(showPresent && isPresent) && (
          <>
            <select
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Month</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
