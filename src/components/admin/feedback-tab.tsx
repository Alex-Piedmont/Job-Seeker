"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FeedbackRow {
  id: string;
  category: "BUG" | "SUGGESTION" | "PRAISE" | "OTHER";
  message: string;
  pageUrl: string | null;
  createdAt: string;
  user: { name: string | null; email: string | null };
}

const CATEGORY_BADGES: Record<
  FeedbackRow["category"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  BUG: { label: "Bug", variant: "destructive" },
  SUGGESTION: { label: "Suggestion", variant: "default" },
  PRAISE: { label: "Praise", variant: "secondary" },
  OTHER: { label: "Other", variant: "outline" },
};

export function FeedbackTab() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      const res = await fetch(`/api/feedback?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFeedback(data.feedback);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load feedback.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} total</p>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            <SelectItem value="BUG">Bug</SelectItem>
            <SelectItem value="SUGGESTION">Suggestion</SelectItem>
            <SelectItem value="PRAISE">Praise</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      ) : feedback.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No feedback yet.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium hidden md:table-cell">
                  Email
                </th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">
                  Page
                </th>
                <th className="px-3 py-2 text-left font-medium">Message</th>
                <th className="px-3 py-2 text-left font-medium hidden md:table-cell">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((item) => {
                const badge = CATEGORY_BADGES[item.category];
                const isExpanded = expandedId === item.id;
                const isLong = item.message.length > 150;
                const displayMessage =
                  isLong && !isExpanded
                    ? item.message.slice(0, 150) + "…"
                    : item.message;

                return (
                  <tr key={item.id} className="border-b">
                    <td className="px-3 py-2.5 font-medium">
                      {item.user.name ?? "Unknown"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell truncate max-w-[200px]">
                      {item.user.email}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={badge.variant} className="text-xs">
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell text-xs">
                      {item.pageUrl ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 max-w-[400px]">
                      <span className="whitespace-pre-wrap break-words">
                        {displayMessage}
                      </span>
                      {isLong && (
                        <button
                          className="ml-1 text-xs text-primary hover:underline"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : item.id)
                          }
                        >
                          {isExpanded ? "show less" : "show more"}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell whitespace-nowrap text-xs">
                      {formatDate(item.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
