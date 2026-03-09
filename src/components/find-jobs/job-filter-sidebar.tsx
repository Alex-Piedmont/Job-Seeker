"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface FilterValues {
  q: string;
  titleLevels: string[];
  customLevel: string;
  companyIds: string[];
  location: string;
  salaryMin: string;
  salaryMax: string;
  postedFrom: string;
  postedTo: string;
  showArchived: boolean;
}

const PRESET_LEVELS = ["Vice President", "Director", "Manager"] as const;

interface Company {
  id: string;
  name: string;
  jobCount: number;
}

interface JobFilterSidebarProps {
  filters: FilterValues;
  companies: Company[];
  onFilterChange: (filters: FilterValues) => void;
  onClearAll: () => void;
}

export const emptyFilters: FilterValues = {
  q: "",
  titleLevels: [],
  customLevel: "",
  companyIds: [],
  location: "",
  salaryMin: "",
  salaryMax: "",
  postedFrom: "",
  postedTo: "",
  showArchived: false,
};

export function JobFilterSidebar({ filters, companies, onFilterChange, onClearAll }: JobFilterSidebarProps) {
  const [companyOpen, setCompanyOpen] = useState(false);

  const update = (partial: Partial<FilterValues>) => {
    onFilterChange({ ...filters, ...partial });
  };

  const toggleCompany = (id: string) => {
    const current = filters.companyIds;
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    update({ companyIds: next });
  };

  const toggleLevel = (level: string) => {
    const current = filters.titleLevels;
    const next = current.includes(level) ? current.filter((l) => l !== level) : [...current, level];
    update({ titleLevels: next });
  };

  const hasFilters =
    filters.q ||
    filters.titleLevels.length > 0 ||
    filters.customLevel ||
    filters.companyIds.length > 0 ||
    filters.location ||
    filters.salaryMin ||
    filters.salaryMax ||
    filters.postedFrom ||
    filters.postedTo;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filters</h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={onClearAll}>
            Clear all
          </Button>
        )}
      </div>

      {/* Title search */}
      <div className="space-y-1.5">
        <Label htmlFor="filter-title" className="text-xs">Job Title</Label>
        <Input
          id="filter-title"
          placeholder="e.g. Software Engineer"
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      {/* Title level filter */}
      <div className="space-y-1.5">
        <Label className="text-xs">Title Level</Label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                filters.titleLevels.includes(level)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-input hover:bg-accent"
              )}
            >
              {level}
            </button>
          ))}
          {filters.customLevel && (
            <button
              type="button"
              onClick={() => toggleLevel(filters.customLevel)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                filters.titleLevels.includes(filters.customLevel)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-input hover:bg-accent"
              )}
            >
              {filters.customLevel}
            </button>
          )}
        </div>
        <Input
          placeholder="Custom: e.g. Analyst, Specialist"
          value={filters.customLevel}
          onChange={(e) => {
            const prev = filters.customLevel;
            const next = e.target.value;
            // If old custom level was selected, remove it and add new one if non-empty
            const levels = filters.titleLevels.filter((l) => l !== prev);
            if (next && filters.titleLevels.includes(prev)) {
              levels.push(next);
            }
            update({ customLevel: next, titleLevels: levels });
          }}
          className="h-8 text-sm"
        />
      </div>

      {/* Company multi-select */}
      <div className="space-y-1.5">
        <Label className="text-xs">Company</Label>
        <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-8 text-sm font-normal">
              {filters.companyIds.length > 0
                ? `${filters.companyIds.length} selected`
                : "All companies"}
              <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0" align="start">
            <div className="max-h-[240px] overflow-y-auto p-1">
              {companies.map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                  onClick={() => toggleCompany(c.id)}
                >
                  <Check className={cn("h-3 w-3", filters.companyIds.includes(c.id) ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 text-left truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">({c.jobCount})</span>
                </button>
              ))}
              {companies.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">No companies found</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {filters.companyIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {filters.companyIds.map((id) => {
              const c = companies.find((co) => co.id === id);
              return c ? (
                <Badge key={id} variant="secondary" className="text-xs gap-1">
                  {c.name}
                  <X
                    className="h-3 w-3 cursor-pointer !pointer-events-auto"
                    onClick={() => toggleCompany(id)}
                  />
                </Badge>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label htmlFor="filter-location" className="text-xs">Location</Label>
        <Input
          id="filter-location"
          placeholder="e.g. San Francisco"
          value={filters.location}
          onChange={(e) => update({ location: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      {/* Salary range */}
      <div className="space-y-1.5">
        <Label className="text-xs">Salary Range</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.salaryMin}
            onChange={(e) => update({ salaryMin: e.target.value })}
            className="h-8 text-sm"
          />
          <span className="text-muted-foreground text-xs">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={filters.salaryMax}
            onChange={(e) => update({ salaryMax: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Date range */}
      <div className="space-y-1.5">
        <Label className="text-xs">Posted Date</Label>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filters.postedFrom}
            onChange={(e) => update({ postedFrom: e.target.value })}
            className="h-8 text-sm"
          />
          <span className="text-muted-foreground text-xs">-</span>
          <Input
            type="date"
            value={filters.postedTo}
            onChange={(e) => update({ postedTo: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Show archived toggle */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Label htmlFor="show-archived" className="text-xs">Show Archived</Label>
        <Switch
          id="show-archived"
          checked={filters.showArchived}
          onCheckedChange={(checked) => update({ showArchived: checked })}
        />
      </div>
    </div>
  );
}
