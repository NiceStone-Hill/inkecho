import { useNavigate } from "react-router-dom";
import { useProgress } from "../state/ProgressContext";
import { getResumeRoute } from "../state/progress";

function EntryPage() {
  const navigate = useNavigate();
  const { progress, startExperience, resetProgress } = useProgress();

  const hasProgress = progress.started;

  function handleStart() {
    if (hasProgress) {
      resetProgress();
    }
    startExperience();
    navigate("/workspace");
  }

  function handleResume() {
    navigate(getResumeRoute(progress));
  }

  return (
    <section className="hero">
      <p className="eyebrow">CASE FILE · NO.13 · UNPROVEN</p>

      <h1>
        你要逃出的
        <br />
        不是牢房
      </h1>

      <p className="introduction">
        《第十三号牢房》越狱悬案。阅读中你会提出自己的逃脱方案，
        AI 只会依据你已读过的证据，追问方案里一个尚未被证明的前提——
        不会剧透任何你还没读到的内容。全程约 10 分钟。
      </p>

      <div className="editor">
        <p style={{ margin: 0, color: "#625c53", fontSize: 15, lineHeight: 1.8 }}>
          无剧透承诺：在你抵达谜底页之前，系统不会展示监狱长最终掌握的完整解释，
          也不会让 AI 提前告诉你答案。
        </p>

        <div className="actions">
          {hasProgress && (
            <button className="secondaryButton" type="button" onClick={handleResume}>
              继续上次的推理
            </button>
          )}
          <button className="primaryButton" type="button" onClick={handleStart}>
            {hasProgress ? "重新开始" : "接受挑战"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default EntryPage;
