"use client";

import { Search, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Column {
  id: string;
  name: string;
}

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  columns: Column[];
  hiddenColumnIds: Set<string>;
  onToggleColumn: (columnId: string) => void;
  onClearFilters: () => void;
  onAddApplication: () => void;
  applicationCount: number;
  applicationCap: number;
  isCapReached: boolean;
}

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  columns,
  hiddenColumnIds,
  onToggleColumn,
  onClearFilters,
  onAddApplication,
  applicationCount,
  applicationCap,
  isCapReached,
}: SearchFilterBarProps) {
  const hasActiveFilters = searchQuery.trim() !== "" || hiddenColumnIds.size > 0;

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search applications..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          role="search"
          aria-label="Search applications"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Columns
            {hiddenColumnIds.size > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({columns.length - hiddenColumnIds.size}/{columns.length})
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-2">
          {columns.map((col) => (
            <label
              key={col.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={!hiddenColumnIds.has(col.id)}
                onChange={() => onToggleColumn(col.id)}
                className="rounded"
              />
              {col.name}
            </label>
          ))}
        </PopoverContent>
      </Popover>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}

      <div className="ml-auto">
        {isCapReached ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button disabled size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Application
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Application limit reached ({applicationCount}/{applicationCap})
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button size="sm" onClick={onAddApplication}>
            <Plus className="h-4 w-4 mr-1" />
            Application
          </Button>
        )}
      </div>
    </div>
  );
}
