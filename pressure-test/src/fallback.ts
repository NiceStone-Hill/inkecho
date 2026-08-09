import type { PressureTestOutput } from "./types.ts";

export const FALLBACK_OUTPUT: Readonly<PressureTestOutput> = Object.freeze({
  selected_assumption: null,
  category: "UNCLEAR",
  pressure_question: "你的方案里，哪一步是文本已经明确证明的，哪一步其实是你自己补上的？",
  rationale_evidence_ids: [],
});

export function fallbackOutput(): PressureTestOutput {
  return {
    ...FALLBACK_OUTPUT,
    rationale_evidence_ids: [],
  };
}
