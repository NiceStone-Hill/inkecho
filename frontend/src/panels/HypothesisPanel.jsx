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

function HypothesisPanel({ onSubmitted, onThinkingChange, analyzeOnSubmit = true }) {
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
      if (!analyzeOnSubmit) {
        submitHypothesisV1(hypothesis);
        onSubmitted?.();
        return;
      }

      const result = await analyzeHypothesis({
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
        现在你已经知道：他没有携带普通工具；监狱禁止替他传递信息；
        自由世界之外隔着七道门和高墙；牢房里存在一根废弃排水管；
        一封本不该能够写出的信出现了。不要追求猜中，试着说清楚你的解释。
      </p>

      <div className="editor">
        <textarea
          value={draft.text}
          onChange={(event) => updateHypothesisDraft({ text: event.target.value })}
          placeholder="输入你的方案……"
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
            {submitting ? "正在保存……" : "锁定我的第一次判断"}
          </button>
        </div>
      </div>
    </>
  );
}

export default HypothesisPanel;
