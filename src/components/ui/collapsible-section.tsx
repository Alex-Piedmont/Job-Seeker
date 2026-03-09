"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = true,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        className="flex items-center gap-2 w-full min-h-[44px] py-2.5 text-sm font-medium hover:text-foreground/80"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        {title}
        {badge && (
          <Badge variant="secondary" className="text-xs ml-1">
            {badge}
          </Badge>
        )}
      </button>
      {open && <div className="pl-6 space-y-3 pb-2">{children}</div>}
    </div>
  );
}
