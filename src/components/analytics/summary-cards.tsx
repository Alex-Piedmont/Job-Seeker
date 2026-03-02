"use client";

import { Briefcase, Users, Calendar, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SummaryCardsProps {
  totalApplications: number;
  activeApplications: number;
  interviewsScheduled: number;
  offers: number;
}

const cards = [
  { key: "total", label: "Total Applications", icon: Briefcase, field: "totalApplications" as const },
  { key: "active", label: "Active", icon: Users, field: "activeApplications" as const },
  { key: "interviews", label: "Interviews", icon: Calendar, field: "interviewsScheduled" as const },
  { key: "offers", label: "Offers", icon: Trophy, field: "offers" as const },
];

export function SummaryCards(props: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className="p-4">
            <dl>
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <card.icon className="h-4 w-4" />
                {card.label}
              </dt>
              <dd className="mt-1 text-3xl font-bold">{props[card.field]}</dd>
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
