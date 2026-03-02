"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface UserLimitEditorProps {
  userId: string;
  userName: string;
  applicationCap: number;
  applicationCount: number;
  resumeGenerationCap: number;
  resumeGenerationsUsedThisMonth: number;
  onSaved: () => void;
  onCancel: () => void;
}

export function UserLimitEditor({
  userId,
  userName,
  applicationCap,
  applicationCount,
  resumeGenerationCap,
  resumeGenerationsUsedThisMonth,
  onSaved,
  onCancel,
}: UserLimitEditorProps) {
  const [appCap, setAppCap] = useState(applicationCap);
  const [resCap, setResCap] = useState(resumeGenerationCap);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/limits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationCap: appCap,
          resumeGenerationCap: resCap,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update limits");
        return;
      }

      toast.success(`Limits updated for ${userName}`);
      onSaved();
    } catch {
      toast.error("Failed to update limits. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t px-4 py-3 space-y-3 bg-muted/30">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Application Cap</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={appCap}
              onChange={(e) => setAppCap(parseInt(e.target.value, 10) || 1)}
              min={1}
              max={10000}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">
              ({applicationCount} used)
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Resume Generation Cap</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={resCap}
              onChange={(e) => setResCap(parseInt(e.target.value, 10) || 1)}
              min={1}
              max={10000}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">
              ({resumeGenerationsUsedThisMonth} used this month)
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
