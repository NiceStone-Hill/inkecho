import { useEffect, useState } from "react";
import { getSolution, getStage } from "../api";
import { useProgress } from "../state/ProgressContext";

const CONFIDENCE_LABEL = {
  low: "低",
  medium: "中",
  high: "高",
};

function RevealPanel() {
  const { progress, markReplayViewed, submitFeedback } = useProgress();
  const { hypothesisV1, hypothesisV2, stressResult, completion } = progress;

  const [solution, setSolution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState(completion.feedback || "");
  const [feedbackSaved, setFeedbackSaved] = useState(Boolean(completion.feedback));
  const [evidenceMap, setEvidenceMap] = useState({});
  const [retryToken, setRetryToken] = useState(0);

  const ready = Boolean(hypothesisV2);

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");

    getSolution()
      .then((data) => {
        if (!cancelled) {
          setSolution(data);
          markReplayViewed();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("暂时无法读取谜底，请检查后端服务是否已启动，然后重试。");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const stageId = progress.reading.currentStageId || 3;
    getStage(stageId)
      .then((data) => {
        const map = {};
        for (const evidence of data.allowed_evidence || []) {
          map[evidence.evidence_id] = evidence.text;
        }
        setEvidenceMap(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) {
    return (
      <p className="stageIntro" style={{ margin: 0 }}>
        完成“作出修正”后，这里会展示监狱长的最终记录与你的推理回放。
      </p>
    );
  }

  function handleRetry() {
    setRetryToken((prev) => prev + 1);
  }

  const textChanged = hypothesisV2?.textChanged;
  const confidenceChanged = hypothesisV2?.confidenceChanged;
  const noChange = !textChanged && !confidenceChanged;

  function handleSubmitFeedback() {
    submitFeedback(feedbackDraft.trim());
    setFeedbackSaved(true);
  }

  return (
    <>
      {loading && <p className="stageIntro">正在解封监狱长的最终记录……</p>}

      {error && (
        <div className="editor">
          <p style={{ margin: 0, color: "#8a3b2e" }}>{error}</p>
          <div className="actions">
            <button className="primaryButton" type="button" onClick={handleRetry}>
              重试
            </button>
          </div>
        </div>
      )}

      {solution && !loading && !error && (
        <>
          <div className="cardGrid" style={{ marginBottom: 10 }}>
            {solution.steps.map((step) => (
              <div className="statementCard" key={step.step_id}>
                <div className="statementCardId">STEP {step.step_id}</div>
                <p className="statementCardText" style={{ marginBottom: 0 }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>

          <h2 className="panelTitle" style={{ fontSize: "clamp(22px, 4vw, 28px)", marginTop: 32 }}>
            我的十三号牢房推理回放
          </h2>

          <div className="cardGrid">
            <div className="statementCard">
              <div className="statementCardId">
                最初判断 · v1（确信度：{CONFIDENCE_LABEL[hypothesisV1?.confidence]}）
              </div>
              <p className="statementCardText" style={{ marginBottom: 0 }}>
                {hypothesisV1?.text}
              </p>
            </div>

            <div className="statementCard">
              <div className="statementCardId">关键转折 · 默认前提</div>
              <p className="statementCardText" style={{ marginBottom: 8 }}>
                {stressResult?.selected_assumption}
              </p>
              <p style={{ margin: "0 0 8px", color: "#625c53", fontSize: 14, lineHeight: 1.7 }}>
                压力问题：{stressResult?.question}
              </p>
              {stressResult?.rationale_evidence_ids?.length > 0 && (
                <p style={{ margin: 0, color: "#92897b", fontSize: 13, lineHeight: 1.7 }}>
                  已使用证据：
                  {stressResult.rationale_evidence_ids
                    .map((evidenceId) => `${evidenceId}（${evidenceMap[evidenceId] || "原文暂不可用"}）`)
                    .join("；")}
                </p>
              )}
            </div>

            <div className="statementCard" style={{ borderLeft: "3px solid #a8977a" }}>
              <div className="statementCardId">
                最终判断 · v2（确信度：{CONFIDENCE_LABEL[hypothesisV2?.confidence]}）
              </div>
              <p className="statementCardText" style={{ marginBottom: 8 }}>
                {hypothesisV2?.text}
              </p>
              <p style={{ margin: 0, color: "#625c53", fontSize: 14, lineHeight: 1.7 }}>
                {noChange
                  ? "诚实说明：这一轮你选择保留原方案与确信度。"
                  : [
                      textChanged && "方案文本发生了修改",
                      confidenceChanged && "确信度发生了变化",
                    ]
                      .filter(Boolean)
                      .join("，")}
                {hypothesisV2?.reason && `  理由：${hypothesisV2.reason}`}
              </p>
            </div>
          </div>

          <div className="editor" style={{ marginTop: 20 }}>
            <p style={{ margin: "0 0 8px", color: "#625c53", fontSize: 14 }}>
              读完谜底，你发现了哪个此前没有意识到的默认前提？
            </p>
            <textarea
              value={feedbackDraft}
              onChange={(event) => setFeedbackDraft(event.target.value)}
              placeholder="写下你的反馈……"
              maxLength={500}
              style={{ minHeight: 90 }}
            />
            <div className="actions">
              <button className="primaryButton" type="button" onClick={handleSubmitFeedback}>
                {feedbackSaved ? "反馈已保存，可继续修改" : "提交反馈"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default RevealPanel;
