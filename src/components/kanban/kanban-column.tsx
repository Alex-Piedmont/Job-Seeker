"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ColumnHeader } from "./column-header";
import { ApplicationCard } from "./application-card";
import type { ColumnData, ApplicationCardData, DragHandleProps } from "@/types/kanban";

export type { ColumnData };

interface KanbanColumnProps {
  column: ColumnData;
  onCardClick: (applicationId: string) => void;
  onSettingsClick: (columnId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  columnDragHandleProps?: DragHandleProps;
  droppableProvided?: {
    setNodeRef: (element: HTMLElement | null) => void;
  };
  renderCard?: (app: ApplicationCardData, index: number) => React.ReactNode;
}

export function KanbanColumn({
  column,
  onCardClick,
  onSettingsClick,
  collapsed,
  onToggleCollapse,
  columnDragHandleProps,
  droppableProvided,
  renderCard,
}: KanbanColumnProps) {
  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center bg-muted/40 rounded-xl border border-border/50 shadow-sm w-12 max-h-full cursor-pointer snap-start shrink-0 py-3 gap-2 hover:bg-muted/60 transition-colors"
        onClick={onToggleCollapse}
        {...columnDragHandleProps?.listeners}
        {...columnDragHandleProps?.attributes}
      >
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
        />
        <Badge variant="secondary" className="text-xs px-1.5">
          {column.applications.length}
        </Badge>
        <span
          className="text-xs font-semibold text-muted-foreground whitespace-nowrap"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {column.name}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-muted/40 rounded-xl border border-border/50 shadow-sm min-w-[320px] w-[320px] max-h-full",
        "snap-start shrink-0"
      )}
    >
      <ColumnHeader
        name={column.name}
        color={column.color}
        applicationCount={column.applications.length}
        onSettingsClick={() => onSettingsClick(column.id)}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        dragHandleProps={columnDragHandleProps}
      />

      <div
        ref={droppableProvided?.setNodeRef}
        className="flex-1 overflow-y-auto px-2 pb-2 space-y-3 min-h-[80px]"
      >
        {column.applications.map((app, index) =>
          renderCard ? (
            renderCard(app, index)
          ) : (
            <ApplicationCard
              key={app.id}
              application={app}
              columnColor={column.color}
              columnType={column.columnType}
              onClick={() => onCardClick(app.id)}
            />
          )
        )}
      </div>
    </div>
  );
}
