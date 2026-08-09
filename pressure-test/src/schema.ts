import { fallbackOutput } from "./fallback.ts";
import { MVP_EVIDENCE } from "./evidence.ts";
import type {
  EvidenceId,
  PressureCategory,
  PressureTestInput,
  PressureTestOutput,
} from "./types.ts";

const CATEGORIES = new Set<PressureCategory>([
  "SPACE_PATH",
  "HUMAN_PASSAGE",
  "TOOL_SOURCE",
  "COMMUNICATION",
  "INSIDER_HELP",
  "UNCLEAR",
]);

const DEMO_EVIDENCE_IDS = new Set<EvidenceId>(["E01", "E02", "E03"]);

const JUDGMENTAL_TERMS = ["你错了", "其实", "正确答案是", "标准答案"];
const KNOWN_SPOILER_TERMS = ["哈奇", "硝酸", "袜线", "布信", "老鼠送信", "排水管传递", "运输工具", "伪装成电工", "换上电工服"];

export const PRESSURE_TEST_JSON_SCHEMA = {
  name: "pressure_test",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "selected_assumption",
      "category",
      "pressure_question",
      "rationale_evidence_ids",
    ],
    properties: {
      selected_assumption: { type: ["string", "null"] },
      category: { enum: [...CATEGORIES] },
      pressure_question: { type: "string" },
      rationale_evidence_ids: {
        type: "array",
        items: { enum: [...DEMO_EVIDENCE_IDS] },
        uniqueItems: true,
      },
    },
  },
} as const;

export function isUsableInput(input: PressureTestInput): boolean {
  const text = input.hypothesis_v1.text.replace(/\s/g, "");
  const supplied = new Map(input.unlocked_evidence.map((item) => [item.id, item.fact.trim()]));

  return (
    input.checkpoint_id === "CP2" &&
    text.length >= 8 &&
    supplied.size === MVP_EVIDENCE.length &&
    MVP_EVIDENCE.every((item) => supplied.get(item.id) === item.fact)
  );
}

export function parsePressureTestOutput(
  raw: string,
  input: PressureTestInput,
): PressureTestOutput {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return fallbackOutput();
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallbackOutput();
  }

  const candidate = value as Record<string, unknown>;
  const expectedKeys = new Set([
    "selected_assumption",
    "category",
    "pressure_question",
    "rationale_evidence_ids",
  ]);

  if (
    Object.keys(candidate).length !== expectedKeys.size ||
    Object.keys(candidate).some((key) => !expectedKeys.has(key)) ||
    !CATEGORIES.has(candidate.category as PressureCategory) ||
    typeof candidate.pressure_question !== "string" ||
    !Array.isArray(candidate.rationale_evidence_ids)
  ) {
    return fallbackOutput();
  }

  const category = candidate.category as PressureCategory;
  const selectedAssumption = candidate.selected_assumption;
  const question = candidate.pressure_question.trim();
  const rationaleIds = candidate.rationale_evidence_ids;
  const unlockedIds = new Set(input.unlocked_evidence.map((item) => item.id));
  const questionMarks = (question.match(/[?？]/g) ?? []).length;
  const generatedText = `${selectedAssumption ?? ""} ${question}`;
  const sourceText = [
    input.hypothesis_v1.text,
    ...input.unlocked_evidence.map((item) => item.fact),
  ].join(" ");
  const introducesKnownSpoiler = KNOWN_SPOILER_TERMS.some(
    (term) => generatedText.includes(term) && !sourceText.includes(term),
  );

  if (category === "UNCLEAR") {
    return selectedAssumption === null && rationaleIds.length === 0
      ? fallbackOutput()
      : fallbackOutput();
  }

  if (
    typeof selectedAssumption !== "string" ||
    selectedAssumption.trim().length === 0 ||
    question.length < 20 ||
    question.length > 60 ||
    questionMarks > 1 ||
    JUDGMENTAL_TERMS.some((term) => generatedText.includes(term)) ||
    introducesKnownSpoiler ||
    rationaleIds.some(
      (id) => typeof id !== "string" || !DEMO_EVIDENCE_IDS.has(id as EvidenceId) || !unlockedIds.has(id as EvidenceId),
    )
  ) {
    return fallbackOutput();
  }

  return {
    selected_assumption: selectedAssumption.trim(),
    category,
    pressure_question: question,
    rationale_evidence_ids: [...new Set(rationaleIds)] as EvidenceId[],
  };
}
