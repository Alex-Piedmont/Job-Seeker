"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { KanbanBoard } from "@/components/kanban/kanban-board";

export default function ApplicationsPage() {
  return (
    <TooltipProvider>
      <KanbanBoard />
    </TooltipProvider>
  );
}
