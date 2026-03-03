"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface RejectionDialogProps {
  open: boolean;
  onConfirm: (rejectionDate: string | null, closedReason: string | null) => void;
  onCancel: () => void;
}

export function RejectionDialog({
  open,
  onConfirm,
  onCancel,
}: RejectionDialogProps) {
  const [rejectionDate, setRejectionDate] = useState("");
  const [ghosted, setGhosted] = useState(false);

  const today = () => new Date().toISOString().split("T")[0];

  const handleConfirm = () => {
    if (ghosted) {
      onConfirm(today(), "ghosted");
    } else {
      // Use entered date, or default to today if left empty
      const date = rejectionDate || today();
      onConfirm(date, "rejected");
    }
    // Reset
    setGhosted(false);
    setRejectionDate("");
  };

  const handleSkip = () => {
    onConfirm(null, null);
    setGhosted(false);
    setRejectionDate("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Close Application</DialogTitle>
          <DialogDescription>
            When were you notified of the outcome?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ghosted}
              onChange={(e) => setGhosted(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Ghosted (no response)</span>
          </label>

          {!ghosted && (
            <div className="space-y-2">
              <Label htmlFor="rejectionDate">Rejection Date</Label>
              <Input
                id="rejectionDate"
                type="date"
                value={rejectionDate}
                onChange={(e) => setRejectionDate(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
