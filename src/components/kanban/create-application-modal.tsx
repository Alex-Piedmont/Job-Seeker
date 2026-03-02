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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Column {
  id: string;
  name: string;
}

interface CreateApplicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: Column[];
  onCreated: () => void;
}

export function CreateApplicationModal({
  open,
  onOpenChange,
  columns,
  onCreated,
}: CreateApplicationModalProps) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [columnId, setColumnId] = useState(columns[0]?.id ?? "");
  const [locationType, setLocationType] = useState<string>("");
  const [primaryLocation, setPrimaryLocation] = useState("");
  const [postingUrl, setPostingUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        company: company.trim(),
        role: role.trim(),
        columnId,
      };
      if (locationType) body.locationType = locationType;
      if (primaryLocation.trim()) body.primaryLocation = primaryLocation.trim();
      if (postingUrl.trim()) body.postingUrl = postingUrl.trim();

      const res = await fetch("/api/kanban/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create application");
        return;
      }

      const app = await res.json();
      toast.success(`Application created as #${app.serialNumber}`);

      // Reset form
      setCompany("");
      setRole("");
      setLocationType("");
      setPrimaryLocation("");
      setPostingUrl("");
      onCreated();
    } catch {
      toast.error("Failed to create application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Application</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company *</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Acme Corp"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Senior Product Manager"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="column">Column</Label>
            <Select value={columnId} onValueChange={setColumnId}>
              <SelectTrigger id="column">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationType">Location Type</Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger id="locationType">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Remote">Remote</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
                <SelectItem value="On-site">On-site</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryLocation">Primary Location</Label>
            <Input
              id="primaryLocation"
              value={primaryLocation}
              onChange={(e) => setPrimaryLocation(e.target.value)}
              placeholder="e.g., San Francisco, CA"
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postingUrl">Posting URL</Label>
            <Input
              id="postingUrl"
              value={postingUrl}
              onChange={(e) => setPostingUrl(e.target.value)}
              placeholder="https://..."
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !company.trim() || !role.trim()}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
