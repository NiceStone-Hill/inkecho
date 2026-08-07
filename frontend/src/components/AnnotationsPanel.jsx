import { useProgress } from "../state/ProgressContext";

function AnnotationsPanel() {
  const { progress, removeAnnotation } = useProgress();
  const annotations = [...progress.annotations].sort((a, b) =>
    a.stageId === b.stageId ? a.segmentIndex - b.segmentIndex : a.stageId - b.stageId,
  );

  if (annotations.length === 0) {
    return (
      <p className="stageIntro" style={{ margin: 0 }}>
        还没有批注。回到原文，选中任意一句话即可添加你的批注或高亮标记。
      </p>
    );
  }

  return (
    <div className="cardGrid">
      {annotations.map((annotation) => (
        <div className="statementCard" key={annotation.id}>
          <div className="statementCardId">STAGE {annotation.stageId} · 你选中的原文</div>
          <p className="statementCardText" style={{ marginBottom: annotation.note ? 8 : 0 }}>
            “{annotation.quote}”
          </p>
          {annotation.note && (
            <p style={{ margin: "0 0 10px", color: "#625c53", fontSize: 14, lineHeight: 1.7 }}>
              {annotation.note}
            </p>
          )}
          <div className="actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="secondaryButton"
              onClick={() => removeAnnotation(annotation.id)}
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AnnotationsPanel;
