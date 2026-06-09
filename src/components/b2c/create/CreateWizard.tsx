"use client";
/**
 * /create multi-step wizard: Design → Who's it for → Details.
 *
 * Single route (not separate pages) because the decoded image + pixel_map live
 * in memory and are expensive — separate routes would lose them. Step lives in
 * component state; the design payload is captured from step 1 and carried
 * forward. Refreshing resets to step 1 (the in-memory design can't be restored).
 */
import { useState } from "react";

import {
  Studio,
  type DesignPayload,
  type StudioLibraryItem,
} from "@/components/b2c/Studio";
import { DetailsStep } from "@/components/b2c/create/DetailsStep";
import { RecipientStep, type Intent } from "@/components/b2c/create/RecipientStep";
import { StepProgress } from "@/components/b2c/create/StepProgress";
import type { EngineSettings } from "@/lib/design-settings";

/** Optional pre-selected ready-made design (from /create?design=…). */
export interface CreateWizardProps {
  initialImageUrl?: string;
  initialImageName?: string;
  initialPlatesX?: number;
  initialPlatesY?: number;
  initialSettings?: Partial<EngineSettings>;
  library?: StudioLibraryItem[];
}

export function CreateWizard({
  initialImageUrl,
  initialImageName,
  initialPlatesX,
  initialPlatesY,
  initialSettings,
  library,
}: CreateWizardProps = {}) {
  const [step, setStep] = useState(1);
  const [design, setDesign] = useState<DesignPayload | null>(null);
  const [intent, setIntent] = useState<Intent>("self");

  // Guard: can't be past the design step without a captured design.
  const safeStep = step > 1 && !design ? 1 : step;

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl px-6 pt-6">
        <StepProgress
          current={safeStep}
          onJump={(s) => design && setStep(s)}
        />
      </div>

      {safeStep === 1 && (
        <Studio
          embedded
          initialImageUrl={initialImageUrl}
          initialImageName={initialImageName}
          initialPlatesX={initialPlatesX}
          initialPlatesY={initialPlatesY}
          initialSettings={initialSettings}
          library={library}
          onProceed={(d) => {
            setDesign(d);
            setStep(2);
          }}
        />
      )}

      {safeStep === 2 && (
        <RecipientStep
          intent={intent}
          onChange={setIntent}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {safeStep === 3 && design && (
        <DetailsStep
          design={design}
          intent={intent}
          onBack={() => setStep(2)}
        />
      )}
    </main>
  );
}
