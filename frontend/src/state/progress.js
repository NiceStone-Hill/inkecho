const STORAGE_KEY = "inkecho_progress_v1";

export function createDefaultProgress() {
  return {
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
    return {
      ...createDefaultProgress(),
      ...parsed,
      reading: {
        ...createDefaultProgress().reading,
        ...(parsed.reading || {}),
      },
      completion: {
        ...createDefaultProgress().completion,
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
