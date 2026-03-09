"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

interface CompanyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: { id: string; name: string; atsPlatform: string; baseUrl: string } | null;
  onSaved: () => void;
}

const ATS_PLATFORMS = ["GREENHOUSE", "LEVER", "WORKDAY", "ICIMS", "ORACLE", "SUCCESSFACTORS"] as const;

export function CompanyForm({ open, onOpenChange, company, onSaved }: CompanyFormProps) {
  const isEdit = Boolean(company);

  const [name, setName] = useState("");
  const [atsPlatform, setAtsPlatform] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(company?.name ?? "");
      setAtsPlatform(company?.atsPlatform ?? "");
      setBaseUrl(company?.baseUrl ?? "");
      setErrors({});
    }
  }, [open, company]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Company name is required.";
    if (!atsPlatform) next.atsPlatform = "ATS platform is required.";
    if (!baseUrl.trim()) {
      next.baseUrl = "Base URL is required.";
    } else if (!baseUrl.startsWith("https")) {
      next.baseUrl = "Base URL must start with https.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/companies/${company!.id}`
        : "/api/admin/companies";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), atsPlatform, baseUrl: baseUrl.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save company");
      }

      toast.success(isEdit ? "Company updated" : "Company created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Company" : "Add Company"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the company source details."
              : "Add a new ATS company source to scrape jobs from."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ats-platform">ATS Platform</Label>
            <Select value={atsPlatform} onValueChange={setAtsPlatform}>
              <SelectTrigger id="ats-platform">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {ATS_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.atsPlatform && (
              <p className="text-sm text-destructive">{errors.atsPlatform}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://boards.greenhouse.io/acme"
            />
            {errors.baseUrl && (
              <p className="text-sm text-destructive">{errors.baseUrl}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
