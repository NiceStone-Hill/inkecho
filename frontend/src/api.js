const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";


const PROGRESS_STORAGE_KEY =
  "inkecho_progress_v1";


const PRESSURE_CHECKPOINT_BY_STAGE = {
  5: "CP2",
  6: "CP3",
};


async function request(
  path,
  options = {},
) {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        headers: {
          "Content-Type":
            "application/json",

          ...(
            options.headers ||
            {}
          ),
        },

        ...options,
      },
    );


  if (!response.ok) {

    let detail =
      `HTTP ${response.status}`;

    try {

      const body =
        await response.json();

      if (
        body &&
        body.detail
      ) {
        detail =
          body.detail;
      }

    } catch {
      // response 不是 JSON
    }

    throw new Error(
      detail
    );
  }


  return (
    response.json()
  );
}


function toFrontendAnnotation(
  annotation,
) {
  return {
    id:
      annotation.id,

    sessionId:
      annotation.session_id,

    stageId:
      annotation.stage_id,

    segmentIndex:
      annotation.segment_index,

    segmentEndIndex:
      annotation.segment_end_index ??
      annotation.segment_index,

    quote:
      annotation.quote,

    spans:
      (
        annotation.spans ||
        []
      ).map(
        (span) => ({
          segmentIndex:
            span.segment_index,

          quote:
            span.quote,
        }),
      ),

    note:
      annotation.note,

    inputMode:
      annotation.input_mode ||
      "text",

    strokes:
      annotation.strokes ||
      [],

    createdAt:
      annotation.created_at,
  };
}


function getCurrentSessionId() {

  if (
    typeof window ===
    "undefined"
  ) {
    return "";
  }


  try {

    const raw =
      window.localStorage
        .getItem(
          PROGRESS_STORAGE_KEY,
        );


    if (!raw) {
      return "";
    }


    const progress =
      JSON.parse(
        raw
      );


    return (
      progress.sessionId ||
      ""
    );

  } catch {

    return "";

  }
}


export function checkHealth() {

  return request(
    "/api/health",
  );
}


export function getAiStatus() {

  return request(
    "/api/ai/status",
  );
}

export async function recognizeHandwriting(
  imageDataUrl,
) {
  const result =
    await request(
      "/api/ocr/handwriting",
      {
        method: "POST",

        body:
          JSON.stringify({
            image_data_url:
              imageDataUrl,
          }),
      },
    );

  return {
    transcript:
      result.transcript ||
      "",

    confidence:
      result.confidence ??
      null,
  };
}


export function getStages() {

  return request(
    "/api/content/stages",
  );
}


export function getStage(
  stageId,
) {

  return request(
    `/api/content/stages/${stageId}`,
  );
}


export function analyzeHypothesis({
  sessionId,
  stageId,
  checkpointId,
  hypothesisText,
  confidence,
}) {

  /*
   * WorkspacePage 现在还没有显式传
   * sessionId / checkpointId。
   *
   * 所以这里自动补上，
   * 这样不用修改 WorkspacePage。
   */

  const resolvedSessionId =
    sessionId ||
    getCurrentSessionId();


  const resolvedCheckpointId =
    checkpointId ||
    PRESSURE_CHECKPOINT_BY_STAGE[
      stageId
    ];


  if (!resolvedSessionId) {

    throw new Error(
      "missing sessionId"
    );
  }


  if (!resolvedCheckpointId) {

    throw new Error(
      `no pressure checkpoint for stage ${stageId}`,
    );
  }


  return request(
    "/api/analyze",

    {
      method:
        "POST",

      body:
        JSON.stringify(
          {
            session_id:
              resolvedSessionId,

            stage_id:
              stageId,

            checkpoint_id:
              resolvedCheckpointId,

            hypothesis_text:
              hypothesisText,

            confidence,
          },
        ),
    },
  );
}


export function getSolution() {

  return request(
    "/api/solution",
  );
}


export function askQuestion({
  sessionId,
  stageId = null,
  question,
}) {

  const resolvedSessionId =
    sessionId ||
    getCurrentSessionId();


  if (!resolvedSessionId) {

    throw new Error(
      "missing sessionId"
    );
  }


  return request(
    "/api/qa/ask",

    {
      method: "POST",

      body:
        JSON.stringify(
          {
            session_id:
              resolvedSessionId,

            stage_id:
              stageId,

            question,
          },
        ),
    },
  );
}


export async function listAnnotations(
  sessionId,
) {

  const annotations =
    await request(
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
  segmentEndIndex,
  quote,
  spans,
  note,
  inputMode = "text",
  strokes = [],
}) {

  const annotation =
    await request(
      "/api/annotations",

      {
        method:
          "POST",

        body:
          JSON.stringify(
            {
              session_id:
                sessionId,

              stage_id:
                stageId,

              segment_index:
                segmentIndex,

              segment_end_index:
                segmentEndIndex ??
                segmentIndex,

              quote,

              spans:
                (spans || []).map(
                  (span) => ({
                    segment_index:
                      span.segmentIndex,

                    quote:
                      span.quote,
                  }),
                ),

              note,

              input_mode:
                inputMode,

              strokes,
            },
          ),
      },
    );


  return (
    toFrontendAnnotation(
      annotation,
    )
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
      method:
        "DELETE",
    },
  );
}