import { useProgress } from "../state/ProgressContext";

const MIN_LENGTH = 50;
const MAX_LENGTH = 500;

const CONFIDENCE_OPTIONS = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

function RevisePanel({ onSubmitted }) {
  const { progress, updateRevisionDraft, submitHypothesisV2 } = useProgress();
  const { hypothesisV1, hypothesisV2, revisionDraft, stressResult } = progress;

  if (!stressResult) {
    return (
      <p className="stageIntro" style={{ margin: 0 }}>
        请先完成“前提审查”，回应压力问题后才能进入修正环节。
      </p>
    );
  }

  if (hypothesisV2) {
    return (
      <div className="editor">
        <div className="statementCardId" style={{ marginBottom: 10 }}>
          已封存 v2
        </div>
        <p style={{ margin: 0, color: "#2c2822", fontSize: 15, lineHeight: 1.8 }}>
          {hypothesisV2.text}
        </p>
        <p style={{ margin: "14px 0 0", color: "#92897b", fontSize: 13 }}>
          v2 已提交并封存，前往“谜底与回放”查看结果。
        </p>
      </div>
    );
  }

  const mode = revisionDraft.mode;
  const text = revisionDraft.text;
  const confidence = revisionDraft.confidence;
  const reason = revisionDraft.reason;

  const trimmedLength = text.trim().length;
  const withinLength = trimmedLength >= MIN_LENGTH && trimmedLength <= MAX_LENGTH;
  const hasReason = reason.trim().length > 0;
  const canSubmit = mode === "revise" ? withinLength && hasReason : hasReason;

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    const finalText = mode === "keep" ? hypothesisV1?.text || "" : text.trim();
    const finalConfidence = mode === "keep" ? hypothesisV1?.confidence : confidence;

    const textChanged = finalText !== hypothesisV1?.text;
    const confidenceChanged = finalConfidence !== hypothesisV1?.confidence;

    submitHypothesisV2({
      text: finalText,
      confidence: finalConfidence,
      reason: reason.trim(),
      revisionType: mode === "revise" ? "revised" : "kept",
      textChanged,
      confidenceChanged,
    });

    onSubmitted?.();
  }

  return (
    <>
      <p className="stageIntro">
        你可以修改方案，也可以保留原方案并说明理由——“不改”同样是一次有效决策。
        提交后进入封存状态，谜底页会对比 v1 与 v2 的变化。
      </p>

      <div className="optionRow" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`optionButton ${mode === "keep" ? "selected" : ""}`}
          onClick={() => updateRevisionDraft({ mode: "keep" })}
        >
          保留原方案
        </button>
        <button
          type="button"
          className={`optionButton ${mode === "revise" ? "selected" : ""}`}
          onClick={() =>
            updateRevisionDraft({
              mode: "revise",
              text: text || hypothesisV1?.text || "",
              confidence: confidence || hypothesisV1?.confidence || "medium",
            })
          }
        >
          修改方案
        </button>
      </div>

      <div className="editor" style={{ marginBottom: 18 }}>
        {mode === "revise" ? (
          <>
            <textarea
              value={text}
              onChange={(event) => updateRevisionDraft({ text: event.target.value })}
              maxLength={MAX_LENGTH}
              placeholder="写下你修改后的方案……"
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
                {trimmedLength} / {MAX_LENGTH} 字
                {trimmedLength < MIN_LENGTH ? `（至少 ${MIN_LENGTH} 字）` : ""}
              </span>
            </div>
            <div className="confidenceGroup">
              {CONFIDENCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`optionButton ${confidence === option.value ? "selected" : ""}`}
                  onClick={() => updateRevisionDraft({ confidence: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: "#2c2822", fontSize: 15, lineHeight: 1.8 }}>
            {hypothesisV1?.text}
          </p>
        )}
      </div>

      <div className="editor">
        <p style={{ margin: "0 0 8px", color: "#625c53", fontSize: 14 }}>
          {mode === "keep" ? "为什么保留原方案？" : "为什么这样修改？"}
        </p>
        <textarea
          value={reason}
          onChange={(event) => updateRevisionDraft({ reason: event.target.value })}
          placeholder="简单说明你的理由……"
          maxLength={MAX_LENGTH}
          style={{ minHeight: 90 }}
        />

        <div className="actions">
          <button
            className="primaryButton"
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            封存 v2 并查看谜底
          </button>
        </div>
      </div>
    </>
  );
}

export default RevisePanel;
