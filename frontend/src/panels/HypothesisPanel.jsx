import { useEffect, useRef, useState } from "react";
import { analyzeHypothesis } from "../api";
import { useProgress } from "../state/ProgressContext";

const MIN_LENGTH = 50;
const MAX_LENGTH = 500;

const CONFIDENCE_OPTIONS = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

function HypothesisPanel({ onSubmitted, onThinkingChange }) {
  const { progress, updateHypothesisDraft, submitHypothesisV1, submitStressResult } =
    useProgress();

  const alreadySubmitted = Boolean(progress.hypothesisV1);
  const draft = progress.hypothesisDraft;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const trimmedLength = draft.text.trim().length;
  const withinLength = trimmedLength >= MIN_LENGTH && trimmedLength <= MAX_LENGTH;
  const canSubmit = withinLength && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");
    onThinkingChange?.(true);

    const hypothesis = {
      text: draft.text.trim(),
      confidence: draft.confidence,
    };

    try {
      const currentStageId = progress.reading.currentStageId || 3;
      const result = await analyzeHypothesis({
        stageId: currentStageId,
        hypothesisText: hypothesis.text,
        confidence: hypothesis.confidence,
      });

      if (!mountedRef.current) {
        return;
      }

      submitHypothesisV1(hypothesis);
      submitStressResult(result);
      onSubmitted?.();
    } catch {
      if (mountedRef.current) {
        setError("暂时无法分析你的方案，请检查后端服务是否已启动，然后重试。提交内容已本地保存，不会丢失。");
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
      onThinkingChange?.(false);
    }
  }

  if (alreadySubmitted) {
    return (
      <div className="editor">
        <div className="statementCardId" style={{ marginBottom: 10 }}>
          已封存 · 确信度：{CONFIDENCE_OPTIONS.find((o) => o.value === progress.hypothesisV1.confidence)?.label}
        </div>
        <p style={{ margin: 0, color: "#2c2822", fontSize: 15, lineHeight: 1.8 }}>
          {progress.hypothesisV1.text}
        </p>
        <p style={{ margin: "14px 0 0", color: "#92897b", fontSize: 13 }}>
          方案已提交并封存，无法修改。请前往“接受审讯”继续。
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="stageIntro">
        根据你已经读到的证据，写下范·杜森教授最可能如何逃脱十三号牢房。
        50—500字，尽量说清楚你依赖的每一个环节。提交后将进入不可修改的封存状态。
      </p>

      <div className="editor">
        <textarea
          value={draft.text}
          onChange={(event) => updateHypothesisDraft({ text: event.target.value })}
          placeholder="例如：他可能先做了什么，然后依靠谁完成了什么……"
          maxLength={MAX_LENGTH}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            color: "#92897b",
            fontSize: 13,
          }}
        >
          <span>确信度</span>
          <span>
            {trimmedLength} / {MAX_LENGTH} 字{trimmedLength < MIN_LENGTH ? `（至少 ${MIN_LENGTH} 字）` : ""}
          </span>
        </div>

        <div className="confidenceGroup">
          {CONFIDENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`optionButton ${draft.confidence === option.value ? "selected" : ""}`}
              onClick={() => updateHypothesisDraft({ confidence: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && <p style={{ color: "#8a3b2e", fontSize: 14, marginTop: 14 }}>{error}</p>}

        <div className="actions">
          <button
            className="primaryButton"
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? "正在分析……" : "封存并提交"}
          </button>
        </div>
      </div>
    </>
  );
}

export default HypothesisPanel;
