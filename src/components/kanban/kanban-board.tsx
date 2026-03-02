"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanColumn, type ColumnData } from "./kanban-column";
import { ApplicationCard, type ApplicationCardData } from "./application-card";
import { SearchFilterBar } from "./search-filter-bar";
import { CreateApplicationModal } from "./create-application-modal";
import { ApplicationDetailDrawer } from "./application-detail-drawer";
import { RejectionDialog } from "./rejection-dialog";
import { ColumnSettingsMenu } from "./column-settings-menu";
import { matchesSearch } from "@/lib/kanban-utils";

interface BoardData {
  columns: ColumnData[];
  applicationCount: number;
  applicationCap: number;
}

export function KanbanBoard() {
  const { data: session } = useSession();
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(
    new Set()
  );
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [settingsColumnId, setSettingsColumnId] = useState<string | null>(null);
  const [rejectionDialog, setRejectionDialog] = useState<{
    applicationId: string;
    columnId: string;
    newOrder: number;
    previousState: ColumnData[];
  } | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/kanban/columns");
      if (!res.ok) throw new Error("Failed to load board");
      const columns: ColumnData[] = await res.json();

      // Fetch user cap info
      const totalApps = columns.reduce(
        (sum, col) => sum + col.applications.length,
        0
      );

      setBoardData({
        columns,
        applicationCount: totalApps,
        applicationCap: 200, // default, could fetch from user profile
      });
    } catch {
      toast.error("Failed to load board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchBoard();
  }, [session, fetchBoard]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!boardData || !result.destination) return;

      const { source, destination, type } = result;

      if (type === "column") {
        // Reorder columns
        const newColumns = [...boardData.columns];
        const [moved] = newColumns.splice(source.index, 1);
        newColumns.splice(destination.index, 0, moved);

        const previousColumns = boardData.columns;
        setBoardData({ ...boardData, columns: newColumns });

        try {
          const res = await fetch("/api/kanban/columns/reorder", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: newColumns.map((c) => c.id) }),
          });
          if (!res.ok) throw new Error();
        } catch {
          setBoardData({ ...boardData, columns: previousColumns });
          toast.error("Failed to reorder columns. Please try again.");
        }
        return;
      }

      // Card drag
      const sourceColIdx = boardData.columns.findIndex(
        (c) => c.id === source.droppableId
      );
      const destColIdx = boardData.columns.findIndex(
        (c) => c.id === destination.droppableId
      );
      if (sourceColIdx === -1 || destColIdx === -1) return;

      const newColumns = boardData.columns.map((col) => ({
        ...col,
        applications: [...col.applications],
      }));

      const sourceCol = newColumns[sourceColIdx];
      const destCol = newColumns[destColIdx];
      const [movedCard] = sourceCol.applications.splice(source.index, 1);
      destCol.applications.splice(destination.index, 0, movedCard);

      const previousColumns = boardData.columns;

      // Check if moving to a closed column — show rejection dialog
      if (
        destCol.columnType === "CLOSED" &&
        sourceCol.id !== destCol.id
      ) {
        // Optimistically update UI
        setBoardData({ ...boardData, columns: newColumns });
        setRejectionDialog({
          applicationId: movedCard.id,
          columnId: destCol.id,
          newOrder: destination.index,
          previousState: previousColumns,
        });
        return;
      }

      // Optimistic update
      setBoardData({ ...boardData, columns: newColumns });

      try {
        const res = await fetch("/api/kanban/applications/move", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: movedCard.id,
            columnId: destination.droppableId,
            newOrder: destination.index,
          }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setBoardData({ ...boardData, columns: previousColumns });
        toast.error("Failed to move application. Please try again.");
      }
    },
    [boardData]
  );

  const handleRejectionConfirm = async (
    rejectionDate: string | null,
    closedReason: string | null
  ) => {
    if (!rejectionDialog || !boardData) return;

    try {
      const res = await fetch("/api/kanban/applications/move", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rejectionDialog.applicationId,
          columnId: rejectionDialog.columnId,
          newOrder: rejectionDialog.newOrder,
          rejectionDate,
          closedReason,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setBoardData({
        ...boardData,
        columns: rejectionDialog.previousState,
      });
      toast.error("Failed to move application. Please try again.");
    }
    setRejectionDialog(null);
  };

  const handleRejectionCancel = () => {
    if (!rejectionDialog || !boardData) return;
    setBoardData({
      ...boardData,
      columns: rejectionDialog.previousState,
    });
    setRejectionDialog(null);
  };

  const handleToggleColumn = (columnId: string) => {
    setHiddenColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setHiddenColumnIds(new Set());
  };

  const handleApplicationCreated = () => {
    setCreateModalOpen(false);
    fetchBoard();
  };

  const handleApplicationUpdated = () => {
    fetchBoard();
  };

  const handleColumnUpdated = () => {
    setSettingsColumnId(null);
    fetchBoard();
  };

  if (!session) {
    return <BoardSkeleton />;
  }

  if (loading) {
    return <BoardSkeleton />;
  }

  if (!boardData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load board. Please refresh the page.
      </div>
    );
  }

  const filteredColumns = boardData.columns
    .filter((col) => !hiddenColumnIds.has(col.id))
    .map((col) => ({
      ...col,
      applications: col.applications.filter((app) =>
        matchesSearch(app, searchQuery)
      ),
    }));

  const isCapReached =
    boardData.applicationCount >= boardData.applicationCap &&
    session.user.role !== "ADMIN";

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        columns={boardData.columns}
        hiddenColumnIds={hiddenColumnIds}
        onToggleColumn={handleToggleColumn}
        onClearFilters={handleClearFilters}
        onAddApplication={() => setCreateModalOpen(true)}
        applicationCount={boardData.applicationCount}
        applicationCap={boardData.applicationCap}
        isCapReached={isCapReached}
      />

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable
          droppableId="board"
          type="column"
          direction="horizontal"
        >
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-4 overflow-x-auto flex-1 pb-4 snap-x snap-mandatory md:snap-none"
            >
              {filteredColumns.map((column, colIndex) => (
                <Draggable
                  key={column.id}
                  draggableId={`col-${column.id}`}
                  index={colIndex}
                >
                  {(colProvided) => (
                    <div
                      ref={colProvided.innerRef}
                      {...colProvided.draggableProps}
                    >
                      <Droppable droppableId={column.id} type="card">
                        {(dropProvided) => (
                          <KanbanColumn
                            column={column}
                            onCardClick={setSelectedAppId}
                            onSettingsClick={setSettingsColumnId}
                            columnDragHandleProps={
                              colProvided.dragHandleProps ?? undefined
                            }
                            droppableProvided={{
                              innerRef: dropProvided.innerRef,
                              droppableProps: dropProvided.droppableProps,
                              placeholder: dropProvided.placeholder,
                            }}
                            renderCard={(app, index) => (
                              <Draggable
                                key={app.id}
                                draggableId={app.id}
                                index={index}
                              >
                                {(cardProvided) => (
                                  <div
                                    ref={cardProvided.innerRef}
                                    {...cardProvided.draggableProps}
                                  >
                                    <ApplicationCard
                                      application={app}
                                      columnColor={column.color}
                                      columnType={column.columnType}
                                      onClick={() => setSelectedAppId(app.id)}
                                      dragHandleProps={
                                        cardProvided.dragHandleProps ??
                                        undefined
                                      }
                                    />
                                  </div>
                                )}
                              </Draggable>
                            )}
                          />
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add Column button */}
              {boardData.columns.length < 12 && (
                <div className="flex items-start pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-w-[140px] h-9"
                    onClick={async () => {
                      const name = prompt("Column name:");
                      if (!name?.trim()) return;
                      try {
                        const res = await fetch("/api/kanban/columns", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: name.trim() }),
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          toast.error(err.error || "Failed to create column");
                          return;
                        }
                        fetchBoard();
                      } catch {
                        toast.error("Failed to create column");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Column
                  </Button>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <CreateApplicationModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        columns={boardData.columns}
        onCreated={handleApplicationCreated}
      />

      {selectedAppId && (
        <ApplicationDetailDrawer
          applicationId={selectedAppId}
          columns={boardData.columns}
          onClose={() => setSelectedAppId(null)}
          onUpdated={handleApplicationUpdated}
          onDeleted={() => {
            setSelectedAppId(null);
            fetchBoard();
          }}
          onDuplicated={(newAppId) => {
            setSelectedAppId(newAppId);
            fetchBoard();
          }}
        />
      )}

      {settingsColumnId && (
        <ColumnSettingsMenu
          columnId={settingsColumnId}
          columns={boardData.columns}
          onClose={() => setSettingsColumnId(null)}
          onUpdated={handleColumnUpdated}
        />
      )}

      <RejectionDialog
        open={rejectionDialog !== null}
        onConfirm={handleRejectionConfirm}
        onCancel={handleRejectionCancel}
      />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
        <div className="ml-auto">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden flex-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="w-[280px] shrink-0 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            {i <= 2 && <Skeleton className="h-24 w-full" />}
          </div>
        ))}
      </div>
    </div>
  );
}
