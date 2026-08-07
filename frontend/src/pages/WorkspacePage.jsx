import { useEffect, useState } from "react";
import { getStage } from "../api";
import { useProgress } from "../state/ProgressContext";
import AnnotationLayer from "../components/AnnotationLayer";
import AIAgentCard from "../components/AIAgentCard";
import AnnotationsPanel from "../components/AnnotationsPanel";
import Panel from "../components/Panel";
import HypothesisPanel from "../panels/HypothesisPanel";
import StressPanel from "../panels/StressPanel";
import RevisePanel from "../panels/RevisePanel";
import RevealPanel from "../panels/RevealPanel";

const TOTAL_STAGES = 3;

const ANSWER_OPTIONS = [
  { value: "confirmed_fact", label: "已确认事实" },
  { value: "physical_constraint", label: "物理或制度约束" },
  { value: "reader_assumption", label: "读者自己的默认前提" },
  { value: "unsure", label: "不确定" },
];

function getAgentNote(progress) {
  if (!progress.reading.completed) {
    return "继续往下读，我会等你读完再和你讨论方案。";
  }
  if (!progress.hypothesisV1) {
    return "读完了？点击上面的“形成方案”告诉我你的判断。";
  }
  if (!progress.hypothesisV2) {
    return "我已经追问了方案里的一个默认前提，点击“接受审讯”回应它。";
  }
  return "谜底已解封，点击“谜底与回放”查看完整记录。";
}

function WorkspacePage() {
  const { progress, answerStatementCard, completeReading, setCurrentStage } =
    useProgress();

  const savedStageId = progress.reading.currentStageId;
  const initialStageIndex = progress.reading.completed
    ? TOTAL_STAGES - 1
    : savedStageId && savedStageId >= 1 && savedStageId <= TOTAL_STAGES
      ? savedStageId - 1
      : 0;

  const [stageIndex, setStageIndex] = useState(initialStageIndex);
  const [stagesData, setStagesData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [openPanel, setOpenPanel] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);

  useEffect(() => {
    const idsToLoad = [];
    for (let id = 1; id <= stageIndex + 1; id += 1) {
      if (!stagesData[id]) {
        idsToLoad.push(id);
      }
    }
    if (idsToLoad.length === 0) {
      return undefined;
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");

    Promise.all(idsToLoad.map((id) => getStage(id)))
      .then((results) => {
        if (cancelled) {
          return;
        }
        setStagesData((prev) => {
          const next = { ...prev };
          results.forEach((data, index) => {
            next[idsToLoad[index]] = data;
          });
          return next;
        });
        setCurrentStage(stageIndex + 1);
      })
      .catch(() => {
        if (!cancelled) {
          setError("暂时无法读取这段档案，请检查后端服务是否已启动，然后重试。");
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
  }, [stageIndex, retryToken]);

  const stageId = stageIndex + 1;
  const stage = stagesData[stageId];
  const cardAnswers = progress.reading.cardAnswers;
  const cards = stage?.statement_cards || [];
  const allCardsAnswered = cards.every((card) => cardAnswers[card.card_id]);
  const canContinue = !loading && !error && allCardsAnswered;

  const hypothesisUnlocked = progress.reading.completed;
  const stressUnlocked = Boolean(progress.hypothesisV1);
  const reviseUnlocked = Boolean(progress.stressResult);
  const revealUnlocked = Boolean(progress.hypothesisV2);

  function handleRetry() {
    setRetryToken((prev) => prev + 1);
  }

  function handleContinue() {
    if (stageIndex + 1 < TOTAL_STAGES) {
      setStageIndex((prev) => prev + 1);
      return;
    }
    completeReading();
    setOpenPanel("hypothesis");
  }

  const agentStatus = aiThinking
    ? "thinking"
    : error
      ? "offline"
      : progress.stressResult?.fallback
        ? "fallback"
        : "online";

  const toolbarItems = [
    {
      key: "hypothesis",
      label: "形成方案",
      unlocked: hypothesisUnlocked,
      done: Boolean(progress.hypothesisV1),
    },
    {
      key: "stress",
      label: "接受审讯",
      unlocked: stressUnlocked,
      done: Boolean(progress.stressResult) && progress.stressAnswer.trim().length > 0,
    },
    {
      key: "revise",
      label: "作出修正",
      unlocked: reviseUnlocked,
      done: Boolean(progress.hypothesisV2),
    },
    {
      key: "reveal",
      label: "谜底与回放",
      unlocked: revealUnlocked,
      done: progress.completion.replayViewed,
    },
    {
      key: "annotations",
      label: `我的批注（${progress.annotations.length}）`,
      unlocked: true,
      done: false,
    },
  ];

  const PANEL_META = {
    hypothesis: { title: "形成方案", subtitle: "CASE FILE · 假说 v1" },
    stress: { title: "接受审讯", subtitle: "CASE FILE · 压力测试" },
    revise: { title: "作出修正", subtitle: "CASE FILE · 假说 v2" },
    reveal: { title: "谜底与回放", subtitle: "CASE FILE · 监狱长记录" },
    annotations: { title: "我的批注", subtitle: "CASE FILE · 原文标记" },
  };

  function handleToolbarClick(item) {
    if (!item.unlocked) {
      return;
    }
    setOpenPanel(item.key);
  }

  return (
    <section className="stagePage">
      <div className="caseHeader">
        <span className="caseNumber">
          CASE FILE · STAGE {stageId} / {TOTAL_STAGES}
        </span>
      </div>

      <AIAgentCard status={agentStatus} note={getAgentNote(progress)} />

      <div className="stageProgressBar">
        {Array.from({ length: TOTAL_STAGES }).map((_, index) => (
          <div
            key={index}
            className={`stageDot ${index <= stageIndex ? "active" : ""}`}
          />
        ))}
      </div>

      <div className="workspaceToolbar">
        {toolbarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`toolbarButton ${item.done ? "done" : ""} ${
              !item.unlocked ? "locked" : ""
            }`}
            disabled={!item.unlocked}
            onClick={() => handleToolbarClick(item)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && !stage && <p className="stageIntro">正在调取档案……</p>}

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

      {stage && !error && (
        <>
          <h1 className="stageTitle">{stage.title}</h1>

          <AnnotationLayer
            stageId={stageId}
            segments={stage.segments}
            onOpenAnnotations={() => setOpenPanel("annotations")}
          />

          {cards.length > 0 && (
            <div className="cardGrid">
              {cards.map((card) => (
                <div className="statementCard" key={card.card_id}>
                  <div className="statementCardId">{card.card_id}</div>
                  <p className="statementCardText">{card.text}</p>
                  <div className="optionRow">
                    {ANSWER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`optionButton ${
                          cardAnswers[card.card_id] === option.value ? "selected" : ""
                        }`}
                        onClick={() => answerStatementCard(card.card_id, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!progress.reading.completed && (
            <div className="continueBar">
              <button
                className="primaryButton"
                type="button"
                disabled={!canContinue}
                onClick={handleContinue}
              >
                {stageIndex + 1 < TOTAL_STAGES ? "继续阅读" : "形成我的方案"}
              </button>
            </div>
          )}
        </>
      )}

      <Panel
        title={PANEL_META.hypothesis.title}
        subtitle={PANEL_META.hypothesis.subtitle}
        open={openPanel === "hypothesis"}
        onClose={() => setOpenPanel(null)}
      >
        <HypothesisPanel
          onSubmitted={() => setOpenPanel("stress")}
          onThinkingChange={setAiThinking}
        />
      </Panel>

      <Panel
        title={PANEL_META.stress.title}
        subtitle={PANEL_META.stress.subtitle}
        open={openPanel === "stress"}
        onClose={() => setOpenPanel(null)}
      >
        <StressPanel onCompleted={() => setOpenPanel("revise")} />
      </Panel>

      <Panel
        title={PANEL_META.revise.title}
        subtitle={PANEL_META.revise.subtitle}
        open={openPanel === "revise"}
        onClose={() => setOpenPanel(null)}
      >
        <RevisePanel onSubmitted={() => setOpenPanel("reveal")} />
      </Panel>

      <Panel
        title={PANEL_META.reveal.title}
        subtitle={PANEL_META.reveal.subtitle}
        open={openPanel === "reveal"}
        onClose={() => setOpenPanel(null)}
      >
        <RevealPanel />
      </Panel>

      <Panel
        title={PANEL_META.annotations.title}
        subtitle={PANEL_META.annotations.subtitle}
        open={openPanel === "annotations"}
        onClose={() => setOpenPanel(null)}
      >
        <AnnotationsPanel />
      </Panel>
    </section>
  );
}

export default WorkspacePage;

