"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  FileText,
  Kanban,
  BarChart3,
  Sparkles,
  ArrowRight,
  Megaphone,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const gettingStartedSteps = [
  {
    step: 1,
    title: "Build your Resume Source",
    description:
      "Add your work history, skills, and education. This is the foundation for generating tailored resumes.",
    href: "/resume-source",
    icon: FileText,
  },
  {
    step: 2,
    title: "Track your Applications",
    description:
      "Add job postings to the kanban board. Organize by stage — Applied, Interview, Offer, and more.",
    href: "/applications",
    icon: Kanban,
  },
  {
    step: 3,
    title: "Generate Tailored Resumes",
    description:
      "From any application card, generate an AI-tailored resume matched to the job description.",
    href: "/applications",
    icon: Sparkles,
  },
];

const quickNavCards = [
  {
    title: "Resume Source",
    description: "Manage your master resume with all your experience and skills.",
    href: "/resume-source",
    icon: FileText,
  },
  {
    title: "Applications",
    description: "Track job applications across every stage of your search.",
    href: "/applications",
    icon: Kanban,
  },
  {
    title: "Analytics",
    description: "Visualize your job search progress and pipeline health.",
    href: "/analytics",
    icon: BarChart3,
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-2 h-5 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const name = session.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {name}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Your AI-powered job search command center. Build resumes, track
          applications, and land interviews faster.
        </p>
      </div>

      {/* Updates & Announcements */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Updates</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 font-medium text-foreground">Mar 2026</span>
                <span>
                  We&apos;re now importing job listings from <strong className="text-foreground">70+ companies</strong> with
                  more being added consistently. Ongoing QA is in progress as we verify each
                  source. Over <strong className="text-foreground">6,800+ roles</strong> are currently listed and growing.
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Getting Started Steps */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Getting Started</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {gettingStartedSteps.map(({ step, title, description, href, icon: Icon }) => (
            <Card key={step} className="relative">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {step}
                  </span>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <CardDescription className="text-sm">
                  {description}
                </CardDescription>
                <Button variant="outline" size="sm" asChild className="w-fit">
                  <Link href={href}>
                    {step === 3 ? "Go to Applications" : "Get Started"}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Quick Navigation */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Quick Navigation</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quickNavCards.map(({ title, description, href, icon: Icon }) => (
            <Link key={title} href={href}>
              <Card className="h-full cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{title}</CardTitle>
                  </div>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
