"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Circle } from "lucide-react";
import type { ResumeSourceData } from "@/types/resume-source";

const SECTIONS = [
  { value: "contact", label: "Contact" },
  { value: "education", label: "Education" },
  { value: "experience", label: "Work Experience" },
  { value: "skills", label: "Skills" },
  { value: "publications", label: "Publications" },
] as const;

export type SectionTab = (typeof SECTIONS)[number]["value"];

function hasData(data: ResumeSourceData | null, section: SectionTab): boolean {
  if (!data) return false;
  switch (section) {
    case "contact":
      return !!(data.contact?.fullName || data.contact?.email);
    case "education":
      return data.education.length > 0;
    case "experience":
      return data.experiences.length > 0;
    case "skills":
      return data.skills.length > 0;
    case "publications":
      return data.publications.length > 0;
  }
}

type SectionTabsProps = {
  activeTab: SectionTab;
  onTabChange: (tab: SectionTab) => void;
  data: ResumeSourceData | null;
};

export function SectionTabs({ activeTab, onTabChange, data }: SectionTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as SectionTab)}>
      <TabsList className="w-full justify-start overflow-x-auto" role="tablist">
        {SECTIONS.map((section) => (
          <TabsTrigger
            key={section.value}
            value={section.value}
            role="tab"
            className="gap-1.5"
          >
            {hasData(data, section.value) ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {section.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
