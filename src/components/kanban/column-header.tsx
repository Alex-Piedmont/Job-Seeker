"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ColumnHeaderProps {
  name: string;
  color: string;
  applicationCount: number;
  onSettingsClick: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps?: any;
}

export function ColumnHeader({
  name,
  color,
  applicationCount,
  onSettingsClick,
  dragHandleProps,
}: ColumnHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-2 py-2"
      {...dragHandleProps}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="font-semibold text-sm truncate">{name}</h3>
        <Badge variant="secondary" className="text-xs shrink-0">
          {applicationCount}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={(e) => {
          e.stopPropagation();
          onSettingsClick();
        }}
        aria-haspopup="menu"
        aria-label={`${name} column settings`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}
