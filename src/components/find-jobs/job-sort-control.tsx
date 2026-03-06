"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortOption = "newest" | "oldest" | "title-asc" | "title-desc" | "salary";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title-asc", label: "Title A-Z" },
  { value: "title-desc", label: "Title Z-A" },
  { value: "salary", label: "Highest Salary" },
];

export function sortToApiParams(sort: SortOption): { sort: string; order: string } {
  switch (sort) {
    case "newest": return { sort: "firstSeenAt", order: "desc" };
    case "oldest": return { sort: "firstSeenAt", order: "asc" };
    case "title-asc": return { sort: "title", order: "asc" };
    case "title-desc": return { sort: "title", order: "desc" };
    case "salary": return { sort: "salaryMax", order: "desc" };
  }
}

interface JobSortControlProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function JobSortControl({ value, onChange }: JobSortControlProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
      <SelectTrigger className="w-[160px] h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
