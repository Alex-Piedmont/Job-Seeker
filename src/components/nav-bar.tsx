"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Menu, LogOut, Download, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { UsageBadge } from "@/components/resume/usage-badge";

type NavItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "divider" };

const buildNavLinks = (userName?: string | null): NavItem[] => [
  { kind: "link", href: "/find-jobs", label: "Find Jobs" },
  { kind: "link", href: "/applications", label: "Applications" },
  { kind: "link", href: "/analytics", label: "Analytics" },
  { kind: "divider" },
  { kind: "link", href: "/dashboard", label: "Getting Started" },
  {
    kind: "link",
    href: "/resume-source",
    label: `All About ${userName?.split(" ")[0] ?? "You"}`,
  },
];

export function NavBar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  if (!session?.user) return null;

  const user = session.user;
  const isAdmin = user.role === "ADMIN";
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "?";

  const navItems = buildNavLinks(user.name);
  const allItems: NavItem[] = isAdmin
    ? [...navItems, { kind: "link", href: "/admin", label: "Admin" }]
    : navItems;

  return (
    <nav className="border-b border-primary/10 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/dashboard" className="text-lg font-semibold">
          Job Seeker
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {allItems.map((item, i) =>
            item.kind === "divider" ? (
              <Separator key={`div-${i}`} orientation="vertical" className="mx-1 h-5" />
            ) : (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={pathname.startsWith(item.href) ? "bg-accent text-accent-foreground" : ""}
                >
                  {item.label}
                </Button>
              </Link>
            )
          )}
        </div>

        {/* User menu + mobile hamburger */}
        <div className="flex items-center gap-2">
          {/* Usage badge (desktop) */}
          <div className="hidden md:block">
            <UsageBadge />
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 p-0"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User dropdown (desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/export" download>
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/signin" })}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile hamburger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Job Seeker</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 pt-4">
                {allItems.map((item, i) =>
                  item.kind === "divider" ? (
                    <Separator key={`div-${i}`} className="my-2" />
                  ) : (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start ${pathname.startsWith(item.href) ? "bg-accent text-accent-foreground" : ""}`}
                      >
                        {item.label}
                      </Button>
                    </Link>
                  )
                )}
                <Separator className="my-2" />
                <div className="flex items-center gap-2 px-4 py-1">
                  <span className="text-sm text-muted-foreground">Resumes:</span>
                  <UsageBadge />
                </div>
                <Separator className="my-2" />
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <Sun className="mr-2 h-4 w-4 dark:hidden" />
                  <Moon className="mr-2 hidden h-4 w-4 dark:block" />
                  Toggle theme
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => signOut({ callbackUrl: "/signin" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
