"use client";

const STEPS = [
  { number: 1, label: "Fit Analysis" },
  { number: 2, label: "Questions" },
  { number: 3, label: "Review" },
];

interface WizardStepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

export function WizardStepIndicator({ currentStep }: WizardStepIndicatorProps) {
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
