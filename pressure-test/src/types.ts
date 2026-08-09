export type Confidence = "low" | "medium" | "high";

export type EvidenceId = "E01" | "E02" | "E03";

export interface UnlockedEvidence {
  id: EvidenceId;
  fact: string;
}

export interface PressureTestInput {
  checkpoint_id: "CP2";
  hypothesis_v1: {
    text: string;
    confidence: Confidence;
  };
  unlocked_evidence: UnlockedEvidence[];
}

export type PressureCategory =
  | "SPACE_PATH"
  | "HUMAN_PASSAGE"
  | "TOOL_SOURCE"
  | "COMMUNICATION"
  | "INSIDER_HELP"
  | "UNCLEAR";

export interface PressureTestOutput {
  selected_assumption: string | null;
  category: PressureCategory;
  pressure_question: string;
  rationale_evidence_ids: EvidenceId[];
}
