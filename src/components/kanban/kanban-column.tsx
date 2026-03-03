"use client";

import { cn } from "@/lib/utils";
import { ColumnHeader } from "./column-header";
import { ApplicationCard, type ApplicationCardData } from "./application-card";

export interface ColumnData {
  id: string;
  name: string;
  color: string;
  columnType: string | null;
  applications: ApplicationCardData[];
}

interface KanbanColumnProps {
  column: ColumnData;
  onCardClick: (applicationId: string) => void;
  onSettingsClick: (columnId: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columnDragHandleProps?: any;
  droppableProvided?: {
    innerRef: (element: HTMLElement | null) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    droppableProps: any;
    placeholder: React.ReactNode;
  };
  renderCard?: (app: ApplicationCardData, index: number) => React.ReactNode;
}

export function KanbanColumn({
  column,
  onCardClick,
  onSettingsClick,
  columnDragHandleProps,
  droppableProvided,
  renderCard,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-muted/40 rounded-xl border border-border/50 shadow-sm min-w-[280px] w-[280px] max-h-full",
        "snap-start shrink-0"
      )}
    >
      <ColumnHeader
        name={column.name}
        color={column.color}
        applicationCount={column.applications.length}
        onSettingsClick={() => onSettingsClick(column.id)}
        dragHandleProps={columnDragHandleProps}
      />

      <div
        ref={droppableProvided?.innerRef}
        {...droppableProvided?.droppableProps}
        className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[80px]"
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
        {droppableProvided?.placeholder}
      </div>
    </div>
  );
}
