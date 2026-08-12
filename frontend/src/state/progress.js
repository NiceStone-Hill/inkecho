const STORAGE_KEY = "inkecho_progress_v1";
const CURRENT_SCHEMA_VERSION = 2;

function createSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultProgress() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sessionId: createSessionId(),
    started: false,
    startedAt: null,
    reading: {
      completed: false,
      trainingCompleted: false,
      cardAnswers: {},
      currentStageId: 1,
    },
    hypothesisDraft: { text: "", confidence: "medium" },
    hypothesisV1: null,
    stressResult: null,
    stressAnswer: "",
    revisionDraft: { mode: "keep", text: "", confidence: "medium", reason: "" },
    hypothesisV2: null,
    annotations: [],
    completion: {
      replayViewed: false,
      feedback: "",
    },
  };
}

function migrateStressResult(result) {
  if (!result) {
    return null;
  }

  return {
    selected_assumption:
      result.selected_assumption ??
      null,
    category:
      result.category === "UNKNOWN"
        ? "UNCLEAR"
        : result.category,
    pressure_question:
      result.pressure_question ||
      result.question ||
      "",
    rationale_evidence_ids:
      result.rationale_evidence_ids ||
      [],
  };
}

export function loadProgress() {
  if (typeof window === "undefined") {
    return createDefaultProgress();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultProgress();
    }

    const parsed = JSON.parse(raw);
    const cleanedParsed = { ...parsed };

    // Remove unreachable V3-era fields from previously saved browser state.
    delete cleanedParsed.stressResult2;
    delete cleanedParsed.stressAnswer2;
    delete cleanedParsed.revisionDraft2;
    delete cleanedParsed.hypothesisV3;

    const defaults = createDefaultProgress();
    const legacy =
      parsed.schemaVersion !==
      CURRENT_SCHEMA_VERSION;

    return {
      ...defaults,
      ...cleanedParsed,
      schemaVersion:
        CURRENT_SCHEMA_VERSION,
      sessionId: parsed.sessionId || defaults.sessionId,
      hypothesisV1:
        legacy
          ? null
          : parsed.hypothesisV1,
      stressResult:
        legacy
          ? null
          : migrateStressResult(parsed.stressResult),
      hypothesisV2:
        legacy
          ? null
          : parsed.hypothesisV2,
      reading: {
        ...defaults.reading,
        ...(parsed.reading || {}),
        currentStageId:
          legacy
            ? 1
            : parsed.reading
                ?.currentStageId || 1,
        trainingCompleted:
          legacy
            ? false
            : Boolean(
                parsed.reading
                  ?.trainingCompleted,
              ),
      },
      completion: {
        ...defaults.completion,
        ...(
          legacy
            ? {}
            : parsed.completion || {}
        ),
      },
    };
  } catch (error) {
    console.error("读取本地进度失败", error);
    return createDefaultProgress();
  }
}

export function saveProgress(progress) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function clearProgress() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getResumeRoute(progress) {
  if (!progress.started) {
    return "/";
  }
  return "/workspace";
}
