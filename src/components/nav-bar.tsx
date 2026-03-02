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
import { Menu, LogOut } from "lucide-react";
import { UsageBadge } from "@/components/resume/usage-badge";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/resume-source", label: "Resume Source" },
  { href: "/applications", label: "Applications" },
  { href: "/analytics", label: "Analytics" },
];

export function NavBar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session?.user) return null;

  const user = session.user;
  const isAdmin = user.role === "ADMIN";
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "?";

  const allLinks = isAdmin
    ? [...navLinks, { href: "/admin", label: "Admin" }]
    : navLinks;

  return (
    <nav className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/dashboard" className="text-lg font-semibold">
          Job Seeker
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {allLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button
                variant={pathname.startsWith(link.href) ? "secondary" : "ghost"}
                size="sm"
              >
                {link.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* User menu + mobile hamburger */}
        <div className="flex items-center gap-2">
          {/* Usage badge (desktop) */}
          <div className="hidden md:block">
            <UsageBadge />
          </div>

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
                {allLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <Button
                      variant={pathname.startsWith(link.href) ? "secondary" : "ghost"}
                      className="w-full justify-start"
                    >
                      {link.label}
                    </Button>
                  </Link>
                ))}
                <Separator className="my-2" />
                <div className="flex items-center gap-2 px-4 py-1">
                  <span className="text-sm text-muted-foreground">Resumes:</span>
                  <UsageBadge />
                </div>
                <Separator className="my-2" />
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
