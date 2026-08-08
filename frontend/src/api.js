const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

async function request(
  path,
  options = {},
) {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers || {}),
      },
      ...options,
    },
  );

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;

    try {
      const body =
        await response.json();

      if (body && body.detail) {
        detail = body.detail;
      }
    } catch {
      // 响应体不是 JSON
    }

    throw new Error(detail);
  }

  return response.json();
}

function toFrontendAnnotation(
  annotation,
) {
  return {
    id: annotation.id,
    sessionId: annotation.session_id,
    stageId: annotation.stage_id,
    segmentIndex:
      annotation.segment_index,
    quote: annotation.quote,
    note: annotation.note,

    inputMode:
      annotation.input_mode || "text",

    strokes:
      annotation.strokes || [],

    createdAt: annotation.created_at,
  };
}

export function checkHealth() {
  return request("/api/health");
}

export function getAiStatus() {
  return request("/api/ai/status");
}

export function getStages() {
  return request(
    "/api/content/stages",
  );
}

export function getStage(stageId) {
  return request(
    `/api/content/stages/${stageId}`,
  );
}

export function analyzeHypothesis({
  stageId,
  hypothesisText,
  confidence,
}) {
  return request("/api/analyze", {
    method: "POST",

    body: JSON.stringify({
      stage_id: stageId,
      hypothesis_text:
        hypothesisText,
      confidence,
    }),
  });
}

export function getSolution() {
  return request("/api/solution");
}

export async function listAnnotations(
  sessionId,
) {
  const annotations = await request(
    `/api/annotations?session_id=${encodeURIComponent(
      sessionId,
    )}`,
  );

  return annotations.map(
    toFrontendAnnotation,
  );
}

export async function createAnnotation({
  sessionId,
  stageId,
  segmentIndex,
  quote,
  note,
  inputMode = "text",
  strokes = [],
}) {
  const annotation = await request(
    "/api/annotations",
    {
      method: "POST",

      body: JSON.stringify({
        session_id: sessionId,
        stage_id: stageId,
        segment_index: segmentIndex,
        quote,
        note,

        input_mode: inputMode,
        strokes,
      }),
    },
  );

  return toFrontendAnnotation(
    annotation,
  );
}

export function deleteAnnotation({
  sessionId,
  annotationId,
}) {
  return request(
    `/api/annotations/${encodeURIComponent(
      annotationId,
    )}?session_id=${encodeURIComponent(
      sessionId,
    )}`,
    {
      method: "DELETE",
    },
  );
}