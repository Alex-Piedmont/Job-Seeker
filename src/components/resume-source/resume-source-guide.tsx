"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STEPS = [
  { number: 1, label: "Why" },
  { number: 2, label: "Example" },
  { number: 3, label: "Get Started" },
] as const;

function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {STEPS.map((step, i) => {
        const isActive = step.number === currentStep;
        const isComplete = step.number < currentStep;

        return (
          <div key={step.number} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-8 ${
                  isComplete ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                {step.number}
              </div>
              <span
                className={`text-xs ${
                  isActive ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepOne() {
  return (
    <div className="space-y-3 text-sm">
      <h3 className="font-semibold text-base">Why structure matters</h3>
      <p className="text-muted-foreground leading-relaxed">
        When you group your experience by theme&mdash;like &ldquo;Key
        Projects&rdquo; or &ldquo;Leadership&rdquo;&mdash;something powerful
        happens: you start remembering accomplishments you&apos;d otherwise
        forget. A flat list of bullets tends to capture only the obvious stuff.
        Subsections act as a thinking tool that helps you dig deeper into each
        role.
      </p>
      <p className="text-muted-foreground leading-relaxed">
        This structured input also gives the AI much better material to work
        with when generating tailored resumes. The richer your source, the
        stronger every resume you create from it.
      </p>
    </div>
  );
}

function StepTwo() {
  return (
    <div className="space-y-4 text-sm">
      <h3 className="font-semibold text-base">Before &amp; After</h3>

      <div className="rounded-md border p-3 space-y-2 bg-muted/30">
        <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
          Before &mdash; flat bullets
        </p>
        <p className="font-medium">Senior PM at Acme Corp</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Managed cross-functional teams</li>
          <li>Launched new product features</li>
          <li>Improved team processes</li>
          <li>Worked with engineering on delivery</li>
        </ul>
      </div>

      <div className="rounded-md border p-3 space-y-3 bg-primary/5 border-primary/20">
        <p className="font-medium text-xs uppercase tracking-wide text-primary">
          After &mdash; organized by theme
        </p>
        <p className="font-medium">Senior PM at Acme Corp</p>

        <div className="space-y-1">
          <p className="font-medium text-xs">Product Strategy</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              Led 0-to-1 launch of analytics dashboard, driving 40% increase in
              enterprise adoption
            </li>
            <li>
              Defined 3-year product roadmap aligned with $50M revenue target
            </li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-xs">Cross-functional Programs</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              Coordinated 4 engineering teams across a platform migration
              serving 2M users
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function StepThree() {
  return (
    <div className="space-y-3 text-sm">
      <h3 className="font-semibold text-base">How to get started</h3>
      <p className="text-muted-foreground leading-relaxed">
        When you add a work experience, you&apos;ll see thinking prompts like
        &ldquo;Projects I Led&rdquo; and &ldquo;Problems I Solved.&rdquo; Click
        any prompt to create a subsection with that label&mdash;then rename it
        to fit your actual experience.
      </p>
      <p className="text-muted-foreground leading-relaxed">
        There&apos;s no right or wrong structure. Some people create 2
        subsections per role, others create 5. The goal is to jog your memory
        and capture everything worth mentioning.
      </p>
      <p className="text-muted-foreground leading-relaxed">
        You can always reopen this guide from the{" "}
        <span className="inline-flex items-center font-medium">?</span> button
        in the page header.
      </p>
    </div>
  );
}

interface ResumeSourceGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResumeSourceGuide({
  open,
  onOpenChange,
}: ResumeSourceGuideProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      try {
        localStorage.setItem("resume-source-guide-seen", "true");
      } catch {
        // localStorage unavailable
      }
      setStep(1);
    }
    onOpenChange(isOpen);
  };

  const handleGotIt = () => {
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:!max-w-xl">
        <DialogHeader>
          <DialogTitle>How to structure your experience</DialogTitle>
        </DialogHeader>

        {step === 1 && <StepOne />}
        {step === 2 && <StepTwo />}
        {step === 3 && <StepThree />}

        <StepIndicator currentStep={step} />

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            disabled={step === 1}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
              Next
            </Button>
          ) : (
            <Button onClick={handleGotIt}>Got it</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
