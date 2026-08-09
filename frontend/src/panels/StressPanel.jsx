import { useProgress } from "../state/ProgressContext";

const CATEGORY_LABEL = {
  TOOL_SOURCE: "工具来源",
  COMMUNICATION: "信息交换",
  HUMAN_PASSAGE: "人体通行",
  SPACE_PATH: "空间路径",
  INSIDER_HELP: "内部协助",
  UNCLEAR: "待证实环节",
};

function StressPanel({ onCompleted }) {
  const { progress, updateStressAnswer } = useProgress();
  const { stressResult, hypothesisV1 } = progress;
  const canContinue = progress.stressAnswer.trim().length > 0;

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
        UNPROVEN 只依据当前解锁的三条 Evidence，检查了你第一次判断中的一个默认前提。
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
        <div className="statementCard" style={{ borderLeft: "3px solid #a8977a" }}>
          <div className="statementCardId">
            压力问题 · {CATEGORY_LABEL[stressResult.category] || CATEGORY_LABEL.UNCLEAR}
          </div>
          <p className="statementCardText" style={{ marginBottom: 0, fontWeight: 600 }}>
            {stressResult.pressure_question}
          </p>
        </div>

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
