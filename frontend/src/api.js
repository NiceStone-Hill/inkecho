const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body && body.detail) {
        detail = body.detail;
      }
    } catch {
      // 响应体不是JSON，忽略
    }
    throw new Error(detail);
  }

  return response.json();
}

export function checkHealth() {
  return request("/api/health");
}

export function getStages() {
  return request("/api/content/stages");
}

export function getStage(stageId) {
  return request(`/api/content/stages/${stageId}`);
}

export function analyzeHypothesis({ stageId, hypothesisText, confidence }) {
  return request("/api/analyze", {
    method: "POST",
    body: JSON.stringify({
      stage_id: stageId,
      hypothesis_text: hypothesisText,
      confidence,
    }),
  });
}

export function getSolution() {
  return request("/api/solution");
}
