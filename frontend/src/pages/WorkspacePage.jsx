import { useCallback, useEffect, useMemo, useState } from "react";
import { analyzeHypothesis, getStage } from "../api";
import { useProgress } from "../state/ProgressContext";
import AnnotationLayer from "../components/AnnotationLayer";
import AnnotationsPanel from "../components/AnnotationsPanel";
import Panel from "../components/Panel";

const TOTAL_PAGES = 8;
const MIN_LENGTH = 30;
const MAX_LENGTH = 600;

const CONFIDENCE_OPTIONS = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

function checkpointDone(progress, checkpoint) {
  if (!checkpoint) {
    return true;
  }
  if (checkpoint.kind === "capture") {
    return Boolean(progress.hypothesisV1);
  }
  if (checkpoint.kind === "pressure") {
    return checkpoint.checkpoint_id === "CP3"
      ? Boolean(progress.hypothesisV3)
      : Boolean(progress.hypothesisV2);
  }
  return Boolean(progress.completion.feedback);
}

function FloatingMenu({ open, onToggle, onOpenAnnotations, onOpenCheckpoint, onReset }) {
  return (
    <div className="readerMenu">
      <button
        type="button"
        className="readerMenuButton"
        aria-label="打开阅读菜单"
        onClick={onToggle}
      >
        ···
      </button>
      {open && (
        <div className="readerMenuPanel">
          <button type="button" onClick={onOpenAnnotations}>
            我的批注
          </button>
          <button type="button" onClick={onOpenCheckpoint}>
            当前 checkpoint
          </button>
          <button type="button" onClick={onReset}>
            重置体验
          </button>
        </div>
      )}
    </div>
  );
}

function CaptureCheckpoint({ progress, checkpoint, onClose }) {
  const { updateHypothesisDraft, submitHypothesisV1 } = useProgress();
  const draft = progress.hypothesisDraft;
  const length = draft.text.trim().length;
  const canSubmit = length >= MIN_LENGTH && length <= MAX_LENGTH;

  if (progress.hypothesisV1) {
    return (
      <div className="checkpointReadOnly">
        <p>{progress.hypothesisV1.text}</p>
        <button className="primaryButton" type="button" onClick={onClose}>
          继续阅读
        </button>
      </div>
    );
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    submitHypothesisV1({
      checkpointId: checkpoint.checkpoint_id,
      text: draft.text.trim(),
      confidence: draft.confidence,
    });
    onClose();
  }

  return (
    <>
      <p className="checkpointPrompt">{checkpoint.prompt}</p>
      <textarea
        value={draft.text}
        onChange={(event) => updateHypothesisDraft({ text: event.target.value })}
        placeholder="写下你此刻的解释..."
        maxLength={MAX_LENGTH}
      />
      <div className="checkpointMeta">
        <span>{length} / {MAX_LENGTH}</span>
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
      </div>
      <div className="actions">
        <button className="primaryButton" type="button" disabled={!canSubmit} onClick={handleSubmit}>
          保存 V1
        </button>
      </div>
    </>
  );
}

function PressureCheckpoint({ stageId, progress, checkpoint, onClose }) {
  const {
    submitHypothesisV1,
    submitStressResult,
    submitStressResult2,
    updateStressAnswer,
    updateStressAnswer2,
    updateRevisionDraft,
    updateRevisionDraft2,
    submitHypothesisV2,
    submitHypothesisV3,
  } = useProgress();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localHypothesis, setLocalHypothesis] = useState({ text: "", confidence: "medium" });
  const [localSubmitted, setLocalSubmitted] = useState(null);
  const isSecondRound = checkpoint.checkpoint_id === "CP3";
  const draft = isSecondRound ? progress.revisionDraft2 : progress.revisionDraft;
  const stressResult = isSecondRound ? progress.stressResult2 : progress.stressResult;
  const stressAnswer = isSecondRound ? progress.stressAnswer2 : progress.stressAnswer;
  const updateAnswer = isSecondRound ? updateStressAnswer2 : updateStressAnswer;
  const updateDraft = isSecondRound ? updateRevisionDraft2 : updateRevisionDraft;
  const submitResult = isSecondRound ? submitStressResult2 : submitStressResult;
  const submitNextHypothesis = isSecondRound ? submitHypothesisV3 : submitHypothesisV2;
  const completedHypothesis = isSecondRound ? progress.hypothesisV3 : progress.hypothesisV2;

  const savedSourceHypothesis = isSecondRound
    ? progress.hypothesisV2
    : progress.hypothesisV1;
  const sourceHypothesis = savedSourceHypothesis || localSubmitted;
  const revisionText = draft.mode === "revise" ? draft.text : sourceHypothesis?.text || "";
  const length = revisionText.trim().length;
  const canSubmit =
    Boolean(stressAnswer.trim()) &&
    (draft.mode === "keep" || (length >= MIN_LENGTH && length <= MAX_LENGTH));

  const runAnalysis = useCallback(async () => {
    if (!sourceHypothesis || stressResult) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await analyzeHypothesis({
        stageId,
        hypothesisText: sourceHypothesis.text,
        confidence: sourceHypothesis.confidence,
      });
      submitResult(result);
    } catch {
      setError("暂时无法生成压力问题，请确认后端服务正在运行。");
    } finally {
      setLoading(false);
    }
  }, [stressResult, sourceHypothesis, stageId, submitResult]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  if (!sourceHypothesis) {
    const localLength = localHypothesis.text.trim().length;
    const canSaveLocal = localLength >= MIN_LENGTH && localLength <= MAX_LENGTH;
    function handleLocalSubmit() {
      if (!canSaveLocal) {
        return;
      }
      const hypothesis = {
        checkpointId: checkpoint.checkpoint_id,
        text: localHypothesis.text.trim(),
        confidence: localHypothesis.confidence,
      };
      if (isSecondRound) {
        submitHypothesisV2({ ...hypothesis, generatedAtCheckpoint: true });
      } else {
        submitHypothesisV1({ ...hypothesis, generatedAtCheckpoint: true });
      }
      setLocalSubmitted(hypothesis);
    }

    return (
      <>
        <p className="checkpointPrompt">
          前一个 checkpoint 尚未保存。你仍然可以在这里写下当前假设，并继续本节点。
        </p>
        <textarea
          value={localHypothesis.text}
          onChange={(event) =>
            setLocalHypothesis((prev) => ({ ...prev, text: event.target.value }))
          }
          placeholder="写下你此刻的解释..."
          maxLength={MAX_LENGTH}
        />
        <div className="checkpointMeta">
          <span>{localLength} / {MAX_LENGTH}</span>
          <div className="confidenceGroup">
            {CONFIDENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`optionButton ${
                  localHypothesis.confidence === option.value ? "selected" : ""
                }`}
                onClick={() =>
                  setLocalHypothesis((prev) => ({ ...prev, confidence: option.value }))
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="actions">
          <button
            className="primaryButton"
            type="button"
            disabled={!canSaveLocal}
            onClick={handleLocalSubmit}
          >
            保存当前假设并生成压力问题
          </button>
        </div>
      </>
    );
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    const finalText = draft.mode === "keep" ? sourceHypothesis.text : revisionText.trim();
    const finalConfidence = draft.mode === "keep" ? sourceHypothesis.confidence : draft.confidence;
    submitNextHypothesis({
      checkpointId: checkpoint.checkpoint_id,
      text: finalText,
      confidence: finalConfidence,
      pressureAnswer: stressAnswer.trim(),
      revisionType: draft.mode === "revise" ? "revised" : "kept",
      textChanged: finalText !== sourceHypothesis.text,
      confidenceChanged: finalConfidence !== sourceHypothesis.confidence,
    });
    onClose();
  }

  if (completedHypothesis) {
    return (
      <div className="checkpointReadOnly">
        <p>{completedHypothesis.text}</p>
        <button className="primaryButton" type="button" onClick={onClose}>
          继续阅读
        </button>
      </div>
    );
  }

  return (
    <>
      <p className="checkpointPrompt">{checkpoint.prompt}</p>
      <div className="checkpointBlock">
        <span>V1</span>
        <p>{sourceHypothesis.text}</p>
      </div>
      {loading && <p className="checkpointPrompt">正在生成压力问题...</p>}
      {error && <p className="checkpointError">{error}</p>}
      {stressResult && (
        <>
          <div className="pressureQuestionBlock">
            <span>压力问题</span>
            <p>{stressResult.question}</p>
          </div>
          <textarea
            value={stressAnswer}
            onChange={(event) => updateAnswer(event.target.value)}
            placeholder="回应这个问题..."
            maxLength={MAX_LENGTH}
          />
          <div className="checkpointSwitch">
            <button
              type="button"
              className={`optionButton ${draft.mode !== "revise" ? "selected" : ""}`}
              onClick={() => updateDraft({ mode: "keep" })}
            >
              保留当前版本
            </button>
            <button
              type="button"
              className={`optionButton ${draft.mode === "revise" ? "selected" : ""}`}
              onClick={() =>
                updateDraft({
                  mode: "revise",
                  text: draft.text || sourceHypothesis.text,
                  confidence: draft.confidence || sourceHypothesis.confidence,
                })
              }
            >
              修正为 V2
            </button>
          </div>
          {draft.mode === "revise" && (
            <>
              <textarea
                value={draft.text}
                onChange={(event) => updateDraft({ text: event.target.value })}
                placeholder="写下修正后的解释..."
                maxLength={MAX_LENGTH}
              />
              <div className="confidenceGroup">
                {CONFIDENCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`optionButton ${draft.confidence === option.value ? "selected" : ""}`}
                    onClick={() => updateDraft({ confidence: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="actions">
            <button className="primaryButton" type="button" disabled={!canSubmit} onClick={handleSubmit}>
              保存 V2
            </button>
          </div>
        </>
      )}
    </>
  );
}

function FinalCheckpoint({ progress, checkpoint, onClose }) {
  const { submitFeedback, markReplayViewed } = useProgress();
  const [text, setText] = useState(progress.completion.feedback || "");
  const canSubmit = text.trim().length >= MIN_LENGTH;

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    submitFeedback(text.trim());
    markReplayViewed();
    onClose();
  }

  return (
    <>
      <p className="checkpointPrompt">{checkpoint.prompt}</p>
      {progress.hypothesisV1 && (
        <div className="checkpointBlock">
          <span>V1</span>
          <p>{progress.hypothesisV1.text}</p>
        </div>
      )}
      {progress.hypothesisV2 && (
        <div className="checkpointBlock">
          <span>V2</span>
          <p>{progress.hypothesisV2.text}</p>
        </div>
      )}
      {progress.hypothesisV3 && (
        <div className="checkpointBlock">
          <span>V3</span>
          <p>{progress.hypothesisV3.text}</p>
        </div>
      )}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="写下当前最完整的解释..."
        maxLength={MAX_LENGTH}
      />
      <div className="actions">
        <button className="primaryButton" type="button" disabled={!canSubmit} onClick={handleSubmit}>
          保存阶段性结论
        </button>
      </div>
    </>
  );
}

function CheckpointPanel({ stage, progress, onClose }) {
  const checkpoint = stage?.checkpoint;
  if (!checkpoint) {
    return <p className="checkpointPrompt">当前页没有新的 checkpoint。</p>;
  }

  return (
    <div className="checkpointContent">
      {checkpoint.kind === "capture" && (
        <CaptureCheckpoint progress={progress} checkpoint={checkpoint} onClose={onClose} />
      )}
      {checkpoint.kind === "pressure" && (
        <PressureCheckpoint
          stageId={stage.stage_id}
          progress={progress}
          checkpoint={checkpoint}
          onClose={onClose}
        />
      )}
      {checkpoint.kind === "final" && (
        <FinalCheckpoint progress={progress} checkpoint={checkpoint} onClose={onClose} />
      )}
    </div>
  );
}

function WorkspacePage() {
  const { progress, setCurrentStage, completeReading, resetProgress } = useProgress();
  const initialPage = Math.min(
    TOTAL_PAGES,
    Math.max(1, progress.reading.currentStageId || 1),
  );
  const [pageId, setPageId] = useState(initialPage);
  const [stagesData, setStagesData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openPanel, setOpenPanel] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  const stage = stagesData[pageId];
  const checkpoint = stage?.checkpoint;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getStage(pageId)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setStagesData((prev) => ({ ...prev, [pageId]: data }));
        setCurrentStage(pageId);
        if (pageId === TOTAL_PAGES) {
          completeReading();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("暂时无法读取文本，请确认后端服务正在运行。");
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
  }, [pageId, setCurrentStage, completeReading]);

  useEffect(() => {
    if (stage?.checkpoint && !checkpointDone(progress, stage.checkpoint)) {
      setOpenPanel("checkpoint");
    }
  }, [
    stage,
    progress.hypothesisV1,
    progress.hypothesisV2,
    progress.hypothesisV3,
    progress.completion.feedback,
  ]);

  const canPrev = pageId > 1;
  const canNext = pageId < TOTAL_PAGES;

  const pageLabel = useMemo(
    () => `${String(pageId).padStart(2, "0")} / ${String(TOTAL_PAGES).padStart(2, "0")}`,
    [pageId],
  );

  function turnPage(direction) {
    setMenuOpen(false);
    setPageId((prev) => {
      const next = prev + direction;
      return Math.min(TOTAL_PAGES, Math.max(1, next));
    });
  }

  function handleTouchEnd(event) {
    if (touchStartX === null) {
      return;
    }
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 55) {
      turnPage(delta < 0 ? 1 : -1);
    }
    setTouchStartX(null);
  }

  function handleOpenCheckpoint() {
    setMenuOpen(false);
    setOpenPanel("checkpoint");
  }

  return (
    <section
      className={`readerPage ${openPanel === "checkpoint" ? "checkpointDocked" : ""}`}
      onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
      onTouchEnd={handleTouchEnd}
    >
      <FloatingMenu
        open={menuOpen}
        onToggle={() => setMenuOpen((prev) => !prev)}
        onOpenAnnotations={() => {
          setMenuOpen(false);
          setOpenPanel("annotations");
        }}
        onOpenCheckpoint={handleOpenCheckpoint}
        onReset={() => {
          setMenuOpen(false);
          resetProgress();
          setPageId(1);
        }}
      />

      <button
        type="button"
        className="pageTurnButton pageTurnPrev"
        aria-label="上一页"
        disabled={!canPrev}
        onClick={() => turnPage(-1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="pageTurnButton pageTurnNext"
        aria-label="下一页"
        disabled={!canNext}
        onClick={() => turnPage(1)}
      >
        ›
      </button>

      <main className="ebookSurface">
        <div className="ebookTopline">
          <span>第十三号牢房</span>
          <span>{pageLabel}</span>
        </div>

        {loading && !stage && <p className="readerMessage">正在翻开这一页...</p>}
        {error && <p className="readerMessage readerError">{error}</p>}

        {stage && !error && (
          <>
            <h1 className="ebookTitle">{stage.title}</h1>
            <AnnotationLayer
              stageId={pageId}
              segments={stage.segments}
              onOpenAnnotations={() => setOpenPanel("annotations")}
            />
          </>
        )}
      </main>

      <div className="readerFooter">
        <span>{checkpoint && checkpointDone(progress, checkpoint) ? "checkpoint 已保存" : ""}</span>
        <span>{pageLabel}</span>
      </div>

      <Panel
        title={checkpoint?.title || "当前 checkpoint"}
        subtitle={checkpoint ? checkpoint.checkpoint_id : "READING"}
        open={openPanel === "checkpoint"}
        onClose={() => setOpenPanel(null)}
        variant="side"
      >
        <CheckpointPanel stage={stage} progress={progress} onClose={() => setOpenPanel(null)} />
      </Panel>

      <Panel
        title="我的批注"
        subtitle="READING NOTES"
        open={openPanel === "annotations"}
        onClose={() => setOpenPanel(null)}
      >
        <AnnotationsPanel />
      </Panel>
    </section>
  );
}

export default WorkspacePage;
