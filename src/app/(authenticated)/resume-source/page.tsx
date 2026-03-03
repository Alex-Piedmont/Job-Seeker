"use client";

import { useState } from "react";
import { useResumeSource } from "@/hooks/use-resume-source";
import { SectionTabs } from "@/components/resume-source/section-tabs";
import { ContactForm } from "@/components/resume-source/contact-form";
import { EducationSection } from "@/components/resume-source/education-section";
import { ExperienceSection } from "@/components/resume-source/experience-section";
import { SkillsSection } from "@/components/resume-source/skills-section";
import { PublicationsSection } from "@/components/resume-source/publications-section";
import { PreviewPanel } from "@/components/resume-source/preview-panel";
import { UploadDialog } from "@/components/resume-source/upload-dialog";
import { CustomSectionEditor } from "@/components/resume-source/custom-section-editor";
import { MiscellaneousEditor } from "@/components/resume-source/miscellaneous-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { ResumeSourceData, ResumeCustomSection } from "@/types/resume-source";

export default function ResumeSourcePage() {
  const { data, isLoading, mutate, refetch } = useResumeSource();
  const [activeTab, setActiveTab] = useState<string>("contact");
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

  const handleImport = (imported: ResumeSourceData) => {
    mutate(() => imported);
    setActiveTab("contact");
  };

  const handleAddSection = async () => {
    try {
      const res = await fetch("/api/resume-source/custom-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Section" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create section");
      }
      const section: ResumeCustomSection = await res.json();
      updateData((prev) => ({
        ...prev,
        customSections: [...prev.customSections, section],
      }));
      setActiveTab(`custom:${section.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create section");
    }
  };

  const handleCustomSectionUpdate = (updated: ResumeCustomSection) => {
    updateData((prev) => ({
      ...prev,
      customSections: prev.customSections.map((s) =>
        s.id === updated.id ? updated : s
      ),
    }));
  };

  const handleCustomSectionDelete = (id: string) => {
    updateData((prev) => ({
      ...prev,
      customSections: prev.customSections.filter((s) => s.id !== id),
    }));
    setActiveTab("contact");
  };

  const handleMiscUpdate = (content: string | null) => {
    updateData((prev) => ({
      ...prev,
      miscellaneous: content,
    }));
  };

  // Determine which custom section is active
  const activeCustomSectionId = activeTab.startsWith("custom:")
    ? activeTab.slice(7)
    : null;
  const activeCustomSection = activeCustomSectionId
    ? data?.customSections.find((s) => s.id === activeCustomSectionId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        {isNew ? (
          <div className="rounded-lg border bg-muted/50 p-4 flex-1 mr-4">
            <h2 className="text-lg font-semibold">
              Let&apos;s build your resume source
            </h2>
            <p className="text-sm text-muted-foreground">
              Start by adding your contact info, or upload an existing markdown
              resume.
            </p>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <UploadDialog onImport={handleImport} />
      </div>

      <SectionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        data={data}
        onAddSection={handleAddSection}
      />

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
          {activeCustomSection && (
            <CustomSectionEditor
              section={activeCustomSection}
              onUpdate={handleCustomSectionUpdate}
              onDelete={handleCustomSectionDelete}
            />
          )}
          {activeTab === "miscellaneous" && (
            <MiscellaneousEditor
              content={data?.miscellaneous ?? null}
              onUpdate={handleMiscUpdate}
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
