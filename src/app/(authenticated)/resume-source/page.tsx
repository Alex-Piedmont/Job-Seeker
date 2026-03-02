"use client";

import { useState } from "react";
import { useResumeSource } from "@/hooks/use-resume-source";
import { SectionTabs, type SectionTab } from "@/components/resume-source/section-tabs";
import { ContactForm } from "@/components/resume-source/contact-form";
import { EducationSection } from "@/components/resume-source/education-section";
import { ExperienceSection } from "@/components/resume-source/experience-section";
import { SkillsSection } from "@/components/resume-source/skills-section";
import { PublicationsSection } from "@/components/resume-source/publications-section";
import { PreviewPanel } from "@/components/resume-source/preview-panel";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResumeSourceData } from "@/types/resume-source";

export default function ResumeSourcePage() {
  const { data, isLoading, mutate } = useResumeSource();
  const [activeTab, setActiveTab] = useState<SectionTab>("contact");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isNew = !data?.contact?.fullName && !data?.contact?.email;

  const updateData = (updater: (prev: ResumeSourceData) => ResumeSourceData) => {
    mutate((prev) => (prev ? updater(prev) : prev));
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {isNew && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <h2 className="text-lg font-semibold">
            Let&apos;s build your resume source
          </h2>
          <p className="text-sm text-muted-foreground">
            Start by adding your contact info. This data powers AI resume
            generation.
          </p>
        </div>
      )}

      <SectionTabs activeTab={activeTab} onTabChange={setActiveTab} data={data} />

      {/* Mobile toggle */}
      <div className="flex gap-2 lg:hidden">
        <button
          onClick={() => setMobileView("edit")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
            mobileView === "edit"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setMobileView("preview")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
            mobileView === "preview"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Preview
        </button>
      </div>

      <div className="flex gap-6">
        {/* Edit panel */}
        <div
          className={`w-full lg:w-[60%] ${
            mobileView === "preview" ? "hidden lg:block" : ""
          }`}
          role="tabpanel"
        >
          {activeTab === "contact" && (
            <ContactForm
              contact={data?.contact ?? null}
              onUpdate={(contact) =>
                updateData((prev) => ({ ...prev, contact }))
              }
            />
          )}
          {activeTab === "education" && (
            <EducationSection
              education={data?.education ?? []}
              onUpdate={(education) =>
                updateData((prev) => ({ ...prev, education }))
              }
            />
          )}
          {activeTab === "experience" && (
            <ExperienceSection
              experiences={data?.experiences ?? []}
              onUpdate={(experiences) =>
                updateData((prev) => ({ ...prev, experiences }))
              }
            />
          )}
          {activeTab === "skills" && (
            <SkillsSection
              skills={data?.skills ?? []}
              onUpdate={(skills) =>
                updateData((prev) => ({ ...prev, skills }))
              }
            />
          )}
          {activeTab === "publications" && (
            <PublicationsSection
              publications={data?.publications ?? []}
              onUpdate={(publications) =>
                updateData((prev) => ({ ...prev, publications }))
              }
            />
          )}
        </div>

        {/* Preview panel */}
        <div
          className={`w-full lg:w-[40%] ${
            mobileView === "edit" ? "hidden lg:block" : ""
          }`}
        >
          <PreviewPanel data={data} />
        </div>
      </div>
    </div>
  );
}
