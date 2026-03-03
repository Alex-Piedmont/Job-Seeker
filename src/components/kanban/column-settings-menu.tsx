"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ColumnData {
  id: string;
  name: string;
  color: string;
  columnType: string | null;
}

interface ColumnSettingsMenuProps {
  columnId: string;
  columns: ColumnData[];
  onClose: () => void;
  onUpdated: () => void;
}

const COLOR_PRESETS = [
  "#002060", "#cc0099", "#5991FF", "#E6E7E8",
  "#6366f1", "#3b82f6", "#f59e0b", "#8b5cf6",
  "#22c55e", "#ef4444", "#14b8a6", "#f97316",
];

export function ColumnSettingsMenu({
  columnId,
  columns,
  onClose,
  onUpdated,
}: ColumnSettingsMenuProps) {
  const column = columns.find((c) => c.id === columnId);
  const [name, setName] = useState(column?.name ?? "");
  const [color, setColor] = useState(column?.color ?? "#6366f1");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!column) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kanban/columns/${columnId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update column");
        return;
      }
      onUpdated();
    } catch {
      toast.error("Failed to update column");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/kanban/columns/${columnId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to delete column");
        return;
      }
      toast.success("Column deleted");
      onUpdated();
    } catch {
      toast.error("Failed to delete column");
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Column Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="colName">Name</Label>
            <Input
              id="colName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: c === color ? "currentColor" : "transparent",
                    transform: c === color ? "scale(1.15)" : "scale(1)",
                  }}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {!confirmDelete ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                >
                  Confirm Delete
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
