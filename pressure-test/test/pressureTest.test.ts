import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { FALLBACK_OUTPUT, buildAgentPrompt, runPressureTest } from "../src/index.ts";
import type { PressureTestInput, PressureTestOutput } from "../src/index.ts";

const INPUT: PressureTestInput = {
  checkpoint_id: "CP2",
  hypothesis_v1: {
    text: "他发现排水管后，会把洞扩大，然后从那里爬出去。",
    confidence: "medium",
  },
  unlocked_evidence: [
    {
      id: "E01",
      fact: "范·杜森入狱时经过彻底搜身，没有携带普通越狱工具或书写材料；监狱方面不会替他进行常规的信息传递。",
    },
    {
      id: "E02",
      fact: "十三号牢房存在一个非标准边界通道，老鼠能够通过与牢门不同的路径离开当前空间。",
    },
    {
      id: "E03",
      fact: "监狱没有内部电工；照明发生故障时，外部照明公司的维修人员可以因正常工作需要进入监狱。",
    },
  ],
};

const VALID_OUTPUT: PressureTestOutput = {
  selected_assumption: "用户默认供老鼠通过的通道也足以让范·杜森本人通行。",
  category: "HUMAN_PASSAGE",
  pressure_question: "你的方案把老鼠能够通过进一步理解成了人也能够通过，目前文本真的证明了这一步吗？",
  rationale_evidence_ids: ["E02"],
};

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;

function mockModel(payload: unknown, ok = true): void {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: typeof payload === "string" ? payload : JSON.stringify(payload) } }],
      }),
      { status: ok ? 200 : 500, headers: { "Content-Type": "application/json" } },
    );
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("buildAgentPrompt 只包含 V1 与传入的三条 Evidence", () => {
  const prompt = buildAgentPrompt(INPUT);
  assert.match(prompt, /Hypothesis V1/);
  assert.match(prompt, /E01:/);
  assert.match(prompt, /E02:/);
  assert.match(prompt, /E03:/);
  assert.doesNotMatch(prompt, /Solution/);
});

test("合法模型 JSON 被解析为严格输出", async () => {
  mockModel(VALID_OUTPUT);
  assert.deepEqual(await runPressureTest(INPUT), VALID_OUTPUT);
});

test("过短的假说不调用模型并直接 fallback", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("should not be called");
  };

  const result = await runPressureTest({
    ...INPUT,
    hypothesis_v1: { text: "不知道", confidence: "low" },
  });
  assert.deepEqual(result, FALLBACK_OUTPUT);
  assert.equal(called, false);
});

test("模型返回非法 JSON 时 fallback", async () => {
  mockModel("not-json");
  assert.deepEqual(await runPressureTest(INPUT), FALLBACK_OUTPUT);
});

test("字段缺失时 fallback", async () => {
  const { pressure_question: _omitted, ...incomplete } = VALID_OUTPUT;
  mockModel(incomplete);
  assert.deepEqual(await runPressureTest(INPUT), FALLBACK_OUTPUT);
});

test("模型引用未解锁 Evidence 时 fallback", async () => {
  mockModel({ ...VALID_OUTPUT, rationale_evidence_ids: ["E04"] });
  assert.deepEqual(await runPressureTest(INPUT), FALLBACK_OUTPUT);
});

test("Evidence ID 没变但事实文字被替换时不调用模型", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("should not be called");
  };

  const result = await runPressureTest({
    ...INPUT,
    unlocked_evidence: INPUT.unlocked_evidence.map((item) =>
      item.id === "E02" ? { ...item, fact: "未审定的新事实" } : item,
    ),
  });
  assert.deepEqual(result, FALLBACK_OUTPUT);
  assert.equal(called, false);
});

test("问题过长或包含多个问句时 fallback", async () => {
  mockModel({
    ...VALID_OUTPUT,
    pressure_question: "目前文本证明了这一步吗？如果不能让人通过怎么办？你是否还有别的解释可以补上这个关键缺口？",
  });
  assert.deepEqual(await runPressureTest(INPUT), FALLBACK_OUTPUT);
});

test("模型引入未出现的谜底机制或判断性语言时 fallback", async () => {
  mockModel({
    ...VALID_OUTPUT,
    pressure_question: "其实他可以用老鼠送信，你的方案还需要这条通道让人通过吗？",
  });
  assert.deepEqual(await runPressureTest(INPUT), FALLBACK_OUTPUT);
});

test("接口失败或未配置 API Key 时 fallback", async () => {
  mockModel({}, false);
  assert.deepEqual(await runPressureTest(INPUT), FALLBACK_OUTPUT);

  delete process.env.OPENAI_API_KEY;
  assert.deepEqual(await runPressureTest(INPUT), FALLBACK_OUTPUT);
});
