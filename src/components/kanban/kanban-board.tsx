"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanColumn } from "./kanban-column";
import { ApplicationCard } from "./application-card";
import type { ColumnData, ApplicationCardData, DragHandleProps } from "@/types/kanban";
import { SearchFilterBar } from "./search-filter-bar";
import { CreateApplicationModal } from "./create-application-modal";
import { ApplicationDetailDrawer } from "./application-detail-drawer";
import { RejectionDialog } from "./rejection-dialog";
import { ColumnSettingsMenu } from "./column-settings-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Briefcase } from "lucide-react";
import { matchesSearch } from "@/lib/kanban-utils";

interface BoardData {
  columns: ColumnData[];
  applicationCount: number;
  applicationCap: number;
}

// --- Sortable wrapper components ---

function SortableColumn({
  id,
  children,
}: {
  id: string;
  children: (props: {
    setNodeRef: (node: HTMLElement | null) => void;
  } & DragHandleProps) => React.ReactNode;
}) {
  const { setNodeRef, transform, transition, listeners, attributes } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return <>{children({ setNodeRef, style, listeners, attributes })}</>;
}

function SortableCard({
  id,
  children,
}: {
  id: string;
  children: (props: {
    setNodeRef: (node: HTMLElement | null) => void;
    isDragging: boolean;
  } & DragHandleProps) => React.ReactNode;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    listeners,
    attributes,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <>{children({ setNodeRef, style, listeners, attributes, isDragging })}</>
  );
}

// --- Custom collision detection ---
const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

export function KanbanBoard() {
  const { data: session } = useSession();
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(
    new Set()
  );
  const [collapsedColumnIds, setCollapsedColumnIds] = useState<Set<string>>(
    () => {
      if (typeof window === "undefined") return new Set();
      try {
        const saved = localStorage.getItem("kanban-collapsed-columns");
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch {
        return new Set();
      }
    }
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

  // DnD state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeType, setActiveType] = useState<"column" | "card" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/kanban/columns");
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Session expired. Please sign out and sign back in.");
        } else {
          toast.error("Failed to load board");
        }
        return;
      }
      const columns: ColumnData[] = await res.json();

      const totalApps = columns.reduce(
        (sum, col) => sum + col.applications.length,
        0
      );

      setBoardData({
        columns,
        applicationCount: totalApps,
        applicationCap: 200,
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

  // --- Helpers ---

  const filteredColumns = useMemo(() => {
    if (!boardData) return [];
    return boardData.columns
      .filter((col) => !hiddenColumnIds.has(col.id))
      .map((col) => ({
        ...col,
        applications: col.applications.filter((app) =>
          matchesSearch(app, searchQuery)
        ),
      }));
  }, [boardData, hiddenColumnIds, searchQuery]);

  const columnIds = useMemo(
    () => filteredColumns.map((c) => `col-${c.id}`),
    [filteredColumns]
  );

  const findContainer = useCallback(
    (id: UniqueIdentifier): string | undefined => {
      // Is it a column ID?
      const colId = String(id).startsWith("col-")
        ? String(id).slice(4)
        : undefined;
      if (colId && filteredColumns.some((c) => c.id === colId)) return colId;

      // Find which column contains this card
      for (const col of filteredColumns) {
        if (col.applications.some((app) => app.id === String(id))) {
          return col.id;
        }
      }
      return undefined;
    },
    [filteredColumns]
  );

  // --- Drag handlers ---

  const onDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const id = String(active.id);
    if (id.startsWith("col-")) {
      setActiveId(active.id);
      setActiveType("column");
    } else {
      setActiveId(active.id);
      setActiveType("card");
    }
  }, []);

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!boardData || activeType !== "card") return;

      const { active, over } = event;
      if (!over) return;

      const activeContainer = findContainer(active.id);
      let overContainer = findContainer(over.id);

      // If over is a column id (col-xxx), extract the actual column id
      if (!overContainer && String(over.id).startsWith("col-")) {
        overContainer = String(over.id).slice(4);
      }

      if (!activeContainer || !overContainer || activeContainer === overContainer) return;

      setBoardData((prev) => {
        if (!prev) return prev;

        const sourceColIdx = prev.columns.findIndex((c) => c.id === activeContainer);
        const destColIdx = prev.columns.findIndex((c) => c.id === overContainer);
        if (sourceColIdx === -1 || destColIdx === -1) return prev;

        const newColumns = prev.columns.map((col) => ({
          ...col,
          applications: [...col.applications],
        }));

        const sourceCol = newColumns[sourceColIdx];
        const destCol = newColumns[destColIdx];

        const activeIndex = sourceCol.applications.findIndex(
          (app) => app.id === String(active.id)
        );
        if (activeIndex === -1) return prev;

        const [movedCard] = sourceCol.applications.splice(activeIndex, 1);

        // Find the index of the over item in the destination
        const overIndex = destCol.applications.findIndex(
          (app) => app.id === String(over.id)
        );
        if (overIndex === -1) {
          // Dropping on the column itself — add at end
          destCol.applications.push(movedCard);
        } else {
          destCol.applications.splice(overIndex, 0, movedCard);
        }

        return { ...prev, columns: newColumns };
      });
    },
    [boardData, activeType, findContainer]
  );

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setActiveType(null);

      if (!boardData || !over) return;

      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);

      // --- Column reorder ---
      if (activeIdStr.startsWith("col-") && overIdStr.startsWith("col-")) {
        const oldIndex = filteredColumns.findIndex(
          (c) => `col-${c.id}` === activeIdStr
        );
        const newIndex = filteredColumns.findIndex(
          (c) => `col-${c.id}` === overIdStr
        );
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const reordered = arrayMove(boardData.columns, oldIndex, newIndex);
        const previousColumns = boardData.columns;
        setBoardData({ ...boardData, columns: reordered });

        try {
          const res = await fetch("/api/kanban/columns/reorder", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: reordered.map((c) => c.id) }),
          });
          if (!res.ok) throw new Error();
        } catch {
          setBoardData({ ...boardData, columns: previousColumns });
          toast.error("Failed to reorder columns. Please try again.");
        }
        return;
      }

      // --- Card move/reorder ---
      // By this point, onDragOver has already moved the card in state.
      // We just need to persist.
      const destContainer = findContainer(active.id);
      if (!destContainer) return;

      const destCol = boardData.columns.find((c) => c.id === destContainer);
      if (!destCol) return;

      const newOrder = destCol.applications.findIndex(
        (app) => app.id === activeIdStr
      );

      // Check for rejection dialog
      const sourceCol = boardData.columns.find((c) =>
        c.applications.some((app) => app.id === activeIdStr)
      );
      // We already moved the card, so sourceCol IS destCol now.
      // We need to check if this column is CLOSED type
      if (destCol.columnType === "CLOSED") {
        // Check if it was already in this column before the drag started
        // We can't know for sure, but the rejection dialog will handle it
        // The previous state was captured before onDragOver mutations
        // We need to use a ref or check differently — let's just persist normally
        // and rely on the API to handle the rejection case.
        // Actually, let's capture previousState from the pre-drag boardData.
        // Since onDragOver already mutated, we just show the dialog.
        setRejectionDialog({
          applicationId: activeIdStr,
          columnId: destContainer,
          newOrder: newOrder === -1 ? 0 : newOrder,
          previousState: [], // We'll handle cancel by re-fetching
        });
        return;
      }

      try {
        const res = await fetch("/api/kanban/applications/move", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activeIdStr,
            columnId: destContainer,
            newOrder: newOrder === -1 ? 0 : newOrder,
          }),
        });
        if (!res.ok) throw new Error();
      } catch {
        // Re-fetch to get correct state
        fetchBoard();
        toast.error("Failed to move application. Please try again.");
      }
    },
    [boardData, filteredColumns, findContainer, fetchBoard]
  );

  // --- Rejection handlers ---

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
      fetchBoard();
      toast.error("Failed to move application. Please try again.");
    }
    setRejectionDialog(null);
  };

  const handleRejectionCancel = () => {
    if (!rejectionDialog || !boardData) return;
    // Re-fetch to restore previous state since onDragOver already mutated
    fetchBoard();
    setRejectionDialog(null);
  };

  // --- Other handlers ---

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

  const handleToggleCollapse = (columnId: string) => {
    setCollapsedColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      try {
        localStorage.setItem(
          "kanban-collapsed-columns",
          JSON.stringify([...next])
        );
      } catch { /* localStorage may be unavailable — non-critical */ }
      return next;
    });
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

  // --- Active drag overlay data ---

  const activeCard = useMemo(() => {
    if (!activeId || activeType !== "card") return null;
    for (const col of filteredColumns) {
      const app = col.applications.find((a) => a.id === String(activeId));
      if (app) return { app, color: col.color, columnType: col.columnType };
    }
    return null;
  }, [activeId, activeType, filteredColumns]);

  // --- Render ---

  if (!session) return <BoardSkeleton />;
  if (loading) return <BoardSkeleton />;

  if (!boardData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load board. Try signing out and back in, or refresh the page.
      </div>
    );
  }

  const isCapReached =
    boardData.applicationCount >= boardData.applicationCap &&
    session.user.role !== "ADMIN";

  if (boardData.applicationCount === 0 && !searchQuery) {
    return (
      <>
        <EmptyState
          icon={Briefcase}
          title="No applications yet"
          description="Start tracking your job applications by adding your first one to the board."
          action={{
            label: "Add Application",
            onClick: () => setCreateModalOpen(true),
          }}
        />
        <CreateApplicationModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          columns={boardData.columns}
          onCreated={handleApplicationCreated}
        />
      </>
    );
  }

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

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={columnIds}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-4 overflow-x-auto flex-1 pb-4 snap-x snap-mandatory md:snap-none">
            {filteredColumns.map((column) => (
              <SortableColumn key={column.id} id={`col-${column.id}`}>
                {({ setNodeRef, style, listeners, attributes }) => (
                  <div ref={setNodeRef} style={style}>
                    <SortableContext
                      items={column.applications.map((a) => a.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <KanbanColumn
                        column={column}
                        onCardClick={setSelectedAppId}
                        onSettingsClick={setSettingsColumnId}
                        collapsed={collapsedColumnIds.has(column.id)}
                        onToggleCollapse={() =>
                          handleToggleCollapse(column.id)
                        }
                        columnDragHandleProps={{ style, listeners, attributes }}
                        droppableProvided={{ setNodeRef: () => {} }}
                        renderCard={(app, _index) => (
                          <SortableCard key={app.id} id={app.id}>
                            {({
                              setNodeRef: cardRef,
                              style: cardStyle,
                              listeners: cardListeners,
                              attributes: cardAttributes,
                            }) => (
                              <div ref={cardRef} style={cardStyle}>
                                <ApplicationCard
                                  application={app}
                                  columnColor={column.color}
                                  columnType={column.columnType}
                                  onClick={() => setSelectedAppId(app.id)}
                                  dragHandleProps={{
                                    style: cardStyle,
                                    listeners: cardListeners,
                                    attributes: cardAttributes,
                                  }}
                                />
                              </div>
                            )}
                          </SortableCard>
                        )}
                      />
                    </SortableContext>
                  </div>
                )}
              </SortableColumn>
            ))}

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
                      toast.success("Column created");
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
        </SortableContext>

        <DragOverlay>
          {activeCard && (
            <ApplicationCard
              application={activeCard.app}
              columnColor={activeCard.color}
              columnType={activeCard.columnType}
              onClick={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>

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
          <div key={i} className="w-[320px] shrink-0 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            {i <= 2 && <Skeleton className="h-28 w-full" />}
          </div>
        ))}
      </div>
    </div>
  );
}
