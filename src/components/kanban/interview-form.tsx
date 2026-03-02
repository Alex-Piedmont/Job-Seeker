"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INTERVIEW_TYPES = [
  "Screening",
  "Hiring Manager",
  "Panel",
  "Technical",
  "Final",
  "Other",
];
const INTERVIEW_FORMATS = ["Virtual", "On-site", "Phone"];

interface Interview {
  id: string;
  type: string;
  format: string;
  people: string | null;
  date: string | null;
  notes: string | null;
  sortOrder: number;
}

interface InterviewFormProps {
  applicationId: string;
  interviews: Interview[];
  onUpdated: () => void;
}

export function InterviewForm({
  applicationId,
  interviews,
  onUpdated,
}: InterviewFormProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInterview, setNewInterview] = useState({
    type: "Screening",
    format: "Virtual",
    people: "",
    date: "",
    notes: "",
  });

  const handleAdd = async () => {
    setAdding(true);
    try {
      const body: Record<string, unknown> = {
        type: newInterview.type,
        format: newInterview.format,
        sortOrder: interviews.length,
      };
      if (newInterview.people.trim()) body.people = newInterview.people.trim();
      if (newInterview.date) body.date = newInterview.date;
      if (newInterview.notes.trim()) body.notes = newInterview.notes.trim();

      const res = await fetch(
        `/api/kanban/applications/${applicationId}/interviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add interview");
        return;
      }
      setShowAddForm(false);
      setNewInterview({
        type: "Screening",
        format: "Virtual",
        people: "",
        date: "",
        notes: "",
      });
      onUpdated();
    } catch {
      toast.error("Failed to add interview");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (
    intId: string,
    field: string,
    value: string | null
  ) => {
    try {
      const res = await fetch(
        `/api/kanban/applications/${applicationId}/interviews/${intId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value || null }),
        }
      );
      if (!res.ok) {
        toast.error("Failed to update interview");
        return;
      }
      onUpdated();
    } catch {
      toast.error("Failed to update interview");
    }
  };

  const handleDelete = async (intId: string) => {
    if (!confirm("Delete this interview?")) return;
    try {
      const res = await fetch(
        `/api/kanban/applications/${applicationId}/interviews/${intId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Failed to delete interview");
        return;
      }
      onUpdated();
    } catch {
      toast.error("Failed to delete interview");
    }
  };

  return (
    <div className="space-y-3">
      {interviews.map((intv) => (
        <div key={intv.id} className="rounded-md border">
          <button
            className="w-full flex items-center justify-between p-2 text-sm hover:bg-accent/50"
            onClick={() =>
              setExpandedId(expandedId === intv.id ? null : intv.id)
            }
          >
            <div className="flex items-center gap-2 text-left">
              <span className="font-medium">{intv.type}</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">{intv.format}</span>
              {intv.date && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-muted-foreground">
                    {new Date(intv.date).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
            {expandedId === intv.id ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {expandedId === intv.id && (
            <div className="p-3 pt-0 space-y-3 border-t">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={intv.type}
                    onValueChange={(v) => handleUpdate(intv.id, "type", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVIEW_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Format</Label>
                  <Select
                    value={intv.format}
                    onValueChange={(v) => handleUpdate(intv.id, "format", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVIEW_FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">People</Label>
                <Input
                  className="h-8 text-xs"
                  defaultValue={intv.people ?? ""}
                  onBlur={(e) =>
                    handleUpdate(intv.id, "people", e.target.value)
                  }
                  maxLength={2000}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  defaultValue={
                    intv.date
                      ? new Date(intv.date).toISOString().split("T")[0]
                      : ""
                  }
                  onBlur={(e) =>
                    handleUpdate(intv.id, "date", e.target.value || null)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  className="text-xs"
                  rows={2}
                  defaultValue={intv.notes ?? ""}
                  onBlur={(e) =>
                    handleUpdate(intv.id, "notes", e.target.value)
                  }
                  maxLength={2000}
                />
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => handleDelete(intv.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Interview
              </Button>
            </div>
          )}
        </div>
      ))}

      {showAddForm ? (
        <div className="rounded-md border p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={newInterview.type}
                onValueChange={(v) =>
                  setNewInterview({ ...newInterview, type: v })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <Select
                value={newInterview.format}
                onValueChange={(v) =>
                  setNewInterview({ ...newInterview, format: v })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">People</Label>
            <Input
              className="h-8 text-xs"
              value={newInterview.people}
              onChange={(e) =>
                setNewInterview({ ...newInterview, people: e.target.value })
              }
              placeholder="Names/roles of interviewers"
              maxLength={2000}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={newInterview.date}
              onChange={(e) =>
                setNewInterview({ ...newInterview, date: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              className="text-xs"
              rows={2}
              value={newInterview.notes}
              onChange={(e) =>
                setNewInterview({ ...newInterview, notes: e.target.value })
              }
              maxLength={2000}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? "Adding..." : "Add Interview"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Interview
        </Button>
      )}
    </div>
  );
}
