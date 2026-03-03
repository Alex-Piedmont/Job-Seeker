"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, Circle, Plus } from "lucide-react";
import type { ResumeSourceData, ResumeCustomSection } from "@/types/resume-source";

const BUILT_IN_SECTIONS = [
  { value: "contact", label: "Contact" },
  { value: "education", label: "Education" },
  { value: "experience", label: "Work Experience" },
  { value: "skills", label: "Skills" },
  { value: "publications", label: "Publications" },
] as const;

export type BuiltInTab = (typeof BUILT_IN_SECTIONS)[number]["value"];

function hasBuiltInData(data: ResumeSourceData | null, section: BuiltInTab): boolean {
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
  activeTab: string;
  onTabChange: (tab: string) => void;
  data: ResumeSourceData | null;
  onAddSection?: () => void;
};

export function SectionTabs({ activeTab, onTabChange, data, onAddSection }: SectionTabsProps) {
  const customSections: ResumeCustomSection[] = data?.customSections ?? [];
  const hasMisc = !!data?.miscellaneous?.trim();
  const canAddSection = customSections.length < 20;

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="w-full justify-start overflow-x-auto" role="tablist">
        {BUILT_IN_SECTIONS.map((section) => (
          <TabsTrigger
            key={section.value}
            value={section.value}
            role="tab"
            className="gap-1.5"
          >
            {hasBuiltInData(data, section.value) ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {section.label}
          </TabsTrigger>
        ))}

        {customSections.map((section) => (
          <TabsTrigger
            key={`custom:${section.id}`}
            value={`custom:${section.id}`}
            role="tab"
            className="gap-1.5"
          >
            {section.content.trim() ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {section.title}
          </TabsTrigger>
        ))}

        {hasMisc && (
          <TabsTrigger
            value="miscellaneous"
            role="tab"
            className="gap-1.5"
          >
            <Check className="h-3.5 w-3.5 text-green-600" />
            Miscellaneous
          </TabsTrigger>
        )}

        {onAddSection && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddSection();
            }}
            disabled={!canAddSection}
            className="h-8 w-8 p-0 ml-1"
            title="Add custom section"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </TabsList>
    </Tabs>
  );
}
