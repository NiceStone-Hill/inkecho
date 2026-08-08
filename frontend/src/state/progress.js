const STORAGE_KEY = "inkecho_progress_v1";

function createSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultProgress() {
  return {
    sessionId: createSessionId(),
    started: false,
    startedAt: null,
    reading: {
      completed: false,
      cardAnswers: {},
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
    const defaults = createDefaultProgress();
    return {
      ...defaults,
      ...parsed,
      sessionId: parsed.sessionId || defaults.sessionId,
      reading: {
        ...defaults.reading,
        ...(parsed.reading || {}),
      },
      completion: {
        ...defaults.completion,
        ...(parsed.completion || {}),
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
