import { fallbackOutput } from "./fallback.ts";
import { buildAgentPrompt } from "./prompt.ts";
import {
  isUsableInput,
  parsePressureTestOutput,
  PRESSURE_TEST_JSON_SCHEMA,
} from "./schema.ts";
import type { PressureTestInput, PressureTestOutput } from "./types.ts";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

function extractContent(body: ChatCompletionResponse): string | null {
  const content = body.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("");
    return text || null;
  }

  return null;
}

export async function runPressureTest(
  input: PressureTestInput,
): Promise<PressureTestOutput> {
  if (!isUsableInput(input)) {
    return fallbackOutput();
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return fallbackOutput();
  }

  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 10_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [{ role: "system", content: buildAgentPrompt(input) }],
        response_format: {
          type: "json_schema",
          json_schema: PRESSURE_TEST_JSON_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 10_000),
    });

    if (!response.ok) {
      return fallbackOutput();
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const content = extractContent(body);
    return content ? parsePressureTestOutput(content, input) : fallbackOutput();
  } catch {
    return fallbackOutput();
  }
}
