import { useEffect, useState } from "react";
import { getStage } from "../api";
import { useProgress } from "../state/ProgressContext";

const CATEGORY_LABEL = {
  external_help: "外部帮助",
  hidden_tool: "隐藏工具",
  physical_path: "物理路径",
  deception: "伪装迷惑",
  unknown: "待证实环节",
};

function StressPanel({ onCompleted }) {
  const { progress, updateStressAnswer } = useProgress();
  const { stressResult, hypothesisV1 } = progress;
  const canContinue = progress.stressAnswer.trim().length > 0;

  const [evidenceMap, setEvidenceMap] = useState({});

  useEffect(() => {
    if (!stressResult) {
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
  }, [stressResult]);

  if (!stressResult || !hypothesisV1) {
    return (
      <p className="stageIntro" style={{ margin: 0 }}>
        请先在“形成方案”里提交你的假说，系统才会生成属于你的压力问题。
      </p>
    );
  }

  return (
    <>
      <p className="stageIntro">
        这是你方案被拆解出的推理链，以及其中一个尚未被文本证明的默认前提。
        {stressResult.fallback && "（当前使用安全兜底问题，AI 服务暂不可用。）"}
      </p>

      <div className="editor" style={{ marginBottom: 18 }}>
        <div className="statementCardId" style={{ marginBottom: 10 }}>
          你的原方案
        </div>
        <p style={{ margin: 0, color: "#2c2822", fontSize: 15, lineHeight: 1.8 }}>
          {hypothesisV1.text}
        </p>
      </div>

      <div className="cardGrid">
        <div className="statementCard">
          <div className="statementCardId">推理链</div>
          <ol style={{ margin: "12px 0 0", paddingLeft: 20, color: "#2c2822", lineHeight: 1.9 }}>
            {stressResult.normalized_steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="statementCard">
          <div className="statementCardId">默认前提</div>
          <p className="statementCardText" style={{ marginBottom: 0 }}>
            {stressResult.selected_assumption}
          </p>
        </div>

        <div className="statementCard" style={{ borderLeft: "3px solid #a8977a" }}>
          <div className="statementCardId">
            压力问题 · {CATEGORY_LABEL[stressResult.category] || CATEGORY_LABEL.unknown}
          </div>
          <p className="statementCardText" style={{ marginBottom: 0, fontWeight: 600 }}>
            {stressResult.question}
          </p>
        </div>

        {stressResult.rationale_evidence_ids?.length > 0 && (
          <div className="statementCard">
            <div className="statementCardId">为什么问：依据的已读证据</div>
            <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: "#625c53", lineHeight: 1.8 }}>
              {stressResult.rationale_evidence_ids.map((evidenceId) => (
                <li key={evidenceId}>
                  <span style={{ color: "#92897b", fontSize: 12, fontWeight: 700 }}>
                    {evidenceId}
                  </span>
                  {"　"}
                  {evidenceMap[evidenceId] || "（原文加载中或暂不可用）"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="editor">
        <textarea
          value={progress.stressAnswer}
          onChange={(event) => updateStressAnswer(event.target.value)}
          placeholder="回应这个问题：这个前提是文本写的，还是你自己补上的？"
        />

        <div className="actions">
          <button
            className="primaryButton"
            type="button"
            disabled={!canContinue}
            onClick={onCompleted}
          >
            回应完毕，作出修正
          </button>
        </div>
      </div>
    </>
  );
}

export default StressPanel;
