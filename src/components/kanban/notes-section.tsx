"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface NotesSectionProps {
  applicationId: string;
  notes: Note[];
  onNoteAdded: () => void;
  onNoteDeleted: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

export function NotesSection({
  applicationId,
  notes,
  onNoteAdded,
  onNoteDeleted,
}: NotesSectionProps) {
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(
        `/api/kanban/applications/${applicationId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newNote.trim() }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add note");
        return;
      }
      setNewNote("");
      onNoteAdded();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      const res = await fetch(
        `/api/kanban/applications/${applicationId}/notes/${noteId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Failed to delete note");
        return;
      }
      onNoteDeleted();
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          maxLength={5000}
          className="text-sm"
        />
        <Button
          size="sm"
          onClick={handleAddNote}
          disabled={adding || !newNote.trim()}
          className="self-end"
        >
          {adding ? "Adding..." : "Add"}
        </Button>
      </div>

      {notes.length === 0 && (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}

      <div className="space-y-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className="group flex gap-2 rounded-md border p-2 text-sm"
          >
            <div className="flex-1 min-w-0">
              <p className="whitespace-pre-wrap break-words">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatRelativeTime(note.createdAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 shrink-0 text-destructive"
              onClick={() => handleDeleteNote(note.id)}
              disabled={deletingId === note.id}
              aria-label="Delete note"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
