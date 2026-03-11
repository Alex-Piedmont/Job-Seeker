"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserLimitEditor } from "./user-limit-editor";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  applicationCap: number;
  applicationCount: number;
  resumeGenerationCap: number;
  resumeGenerationsUsedThisMonth: number;
  totalResumeGenerations: number;
  estimatedTotalCost: number;
  lastActiveAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortField =
  | "name"
  | "email"
  | "applicationCount"
  | "resumeGenerationsUsedThisMonth"
  | "estimatedTotalCost"
  | "lastActiveAt"
  | "createdAt";

const COLUMNS: Array<{ key: SortField; label: string; className?: string }> = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email", className: "hidden md:table-cell" },
  { key: "applicationCount", label: "Apps" },
  { key: "resumeGenerationsUsedThisMonth", label: "Resumes/Mo" },
  { key: "estimatedTotalCost", label: "Est. Cost", className: "hidden lg:table-cell" },
  { key: "lastActiveAt", label: "Last Active", className: "hidden lg:table-cell" },
];

export function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortField>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
          search,
          sort,
          order,
        });
        const res = await fetch(`/api/admin/users?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setUsers(data.users);
        setPagination(data.pagination);
      } catch {
        toast.error("Failed to load users.");
      } finally {
        setLoading(false);
      }
    },
    [search, sort, order]
  );

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // fetchUsers will trigger via useEffect
    }, 300);
  };

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setOrder("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort !== field) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return order === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name or email..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
          aria-label="Search users by name or email"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm" aria-live="polite">
              <thead>
                <tr className="border-b bg-muted/50">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-left font-medium ${col.className ?? ""}`}
                    >
                      <button
                        className="flex items-center hover:text-foreground"
                        onClick={() => handleSort(col.key)}
                        aria-sort={
                          sort === col.key
                            ? order === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        {col.label}
                        <SortIcon field={col.key} />
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium hidden md:table-cell">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isAdmin = user.role === "ADMIN";
                  const isExpanded = expandedId === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="group border-b cursor-pointer hover:bg-muted/30"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : user.id)
                      }
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-medium truncate block">
                          {user.name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground truncate max-w-[200px]">
                        {user.email}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isAdmin
                          ? "Unlimited"
                          : `${user.applicationCount}/${user.applicationCap}`}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isAdmin
                          ? "Unlimited"
                          : `${user.resumeGenerationsUsedThisMonth}/${user.resumeGenerationCap}`}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell whitespace-nowrap">
                        Est. ${user.estimatedTotalCost.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell whitespace-nowrap text-muted-foreground">
                        {formatDate(user.lastActiveAt)}
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <Badge
                          variant={isAdmin ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {user.role}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {users.map((user) => {
                  const isAdmin = user.role === "ADMIN";
                  const isExpanded = expandedId === user.id;
                  if (!isExpanded || isAdmin) return null;
                  return (
                    <tr key={`${user.id}-expand`}>
                      <td colSpan={COLUMNS.length + 1} className="p-0">
                        <UserLimitEditor
                          userId={user.id}
                          userName={user.name}
                          applicationCap={user.applicationCap}
                          applicationCount={user.applicationCount}
                          resumeGenerationCap={user.resumeGenerationCap}
                          resumeGenerationsUsedThisMonth={
                            user.resumeGenerationsUsedThisMonth
                          }
                          onSaved={() => {
                            setExpandedId(null);
                            fetchUsers(pagination.page);
                          }}
                          onCancel={() => setExpandedId(null)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length + 1}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchUsers(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchUsers(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
