"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompanyForm } from "./company-form";

interface Company {
  id: string;
  name: string;
  atsPlatform: string;
  baseUrl: string;
  enabled: boolean;
  lastScrapeAt: string | null;
  scrapeStatus: string;
  scrapeError: string | null;
  _count: { scrapedJobs: number };
}

type SortField = "name" | "atsPlatform" | "lastScrapeAt" | "enabled";
type SortOrder = "asc" | "desc";

export function JobSourcesTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortField>("name");
  const [order, setOrder] = useState<SortOrder>("asc");

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Track which companies are currently syncing
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/companies?sort=${sort}&order=${order}`
      );
      if (!res.ok) throw new Error("Failed to fetch companies");
      const data = await res.json();
      setCompanies(data.companies);
    } catch {
      toast.error("Failed to load job sources");
    } finally {
      setLoading(false);
    }
  }, [sort, order]);

  useEffect(() => {
    setLoading(true);
    fetchCompanies();
  }, [fetchCompanies]);

  function handleSort(field: SortField) {
    if (sort === field) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder("asc");
    }
  }

  function sortIcon(field: SortField) {
    if (sort !== field) return <ChevronsUpDown className="ml-1 inline h-4 w-4" />;
    return order === "asc" ? (
      <ChevronUp className="ml-1 inline h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 inline h-4 w-4" />
    );
  }

  async function handleToggle(company: Company) {
    const prev = company.enabled;
    // Optimistic update
    setCompanies((cs) =>
      cs.map((c) => (c.id === company.id ? { ...c, enabled: !prev } : c))
    );
    try {
      const res = await fetch(`/api/admin/companies/${company.id}/toggle`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to toggle");
    } catch {
      // Revert
      setCompanies((cs) =>
        cs.map((c) => (c.id === company.id ? { ...c, enabled: prev } : c))
      );
      toast.error("Failed to toggle company");
    }
  }

  async function handleSync(company: Company) {
    setSyncingIds((prev) => new Set(prev).add(company.id));
    try {
      const res = await fetch(`/api/admin/companies/${company.id}/scrape`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to trigger scrape");
      toast.success(`Scrape triggered for ${company.name}`);
      // Update status locally
      setCompanies((cs) =>
        cs.map((c) =>
          c.id === company.id ? { ...c, scrapeStatus: "PENDING" } : c
        )
      );
    } catch {
      toast.error(`Failed to trigger scrape for ${company.name}`);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(company.id);
        return next;
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/companies/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      fetchCompanies();
    } catch {
      toast.error("Failed to delete company");
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    setEditingCompany(null);
    setFormOpen(true);
  }

  function openEdit(company: Company) {
    setEditingCompany(company);
    setFormOpen(true);
  }

  function isScraping(company: Company) {
    return company.scrapeStatus === "PENDING";
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="rounded-md border">
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {companies.length} company source{companies.length !== 1 && "s"}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Add Company
        </Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">
                <button
                  className="inline-flex items-center"
                  onClick={() => handleSort("name")}
                >
                  Company Name {sortIcon("name")}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button
                  className="inline-flex items-center"
                  onClick={() => handleSort("atsPlatform")}
                >
                  ATS Platform {sortIcon("atsPlatform")}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">Base URL</th>
              <th className="px-4 py-3 text-left font-medium">
                <button
                  className="inline-flex items-center"
                  onClick={() => handleSort("enabled")}
                >
                  Enabled {sortIcon("enabled")}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button
                  className="inline-flex items-center"
                  onClick={() => handleSort("lastScrapeAt")}
                >
                  Last Scraped {sortIcon("lastScrapeAt")}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">Total Jobs</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No company sources yet. Add one to get started.
                </td>
              </tr>
            )}
            {companies.map((company) => (
              <tr
                key={company.id}
                className={`border-b last:border-0 ${!company.enabled ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3 font-medium">{company.name}</td>
                <td className="px-4 py-3">
                  {company.atsPlatform.charAt(0) +
                    company.atsPlatform.slice(1).toLowerCase()}
                </td>
                <td className="px-4 py-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default truncate block max-w-[200px]">
                        {company.baseUrl}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="max-w-xs break-all">{company.baseUrl}</p>
                    </TooltipContent>
                  </Tooltip>
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={company.enabled}
                    onCheckedChange={() => handleToggle(company)}
                  />
                </td>
                <td className="px-4 py-3">
                  {isScraping(company) ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Scraping...
                    </span>
                  ) : company.lastScrapeAt ? (
                    formatDistanceToNow(new Date(company.lastScrapeAt), {
                      addSuffix: true,
                    })
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </td>
                <td className="px-4 py-3">{company._count.scrapedJobs}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSync(company)}
                          disabled={syncingIds.has(company.id) || isScraping(company)}
                        >
                          {syncingIds.has(company.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Sync now</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(company)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(company)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Company Form Dialog (Create / Edit) */}
      <CompanyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        company={editingCompany}
        onSaved={fetchCompanies}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              This will not delete previously scraped jobs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Removing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
