import { useCallback, useEffect, useState } from "react";
import { analyzeHypothesis, getAiStatus, getStage } from "../api";
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
  { value: "confirmed_fact", label: "文本已经证明的事实" },
  { value: "unproven", label: "尚未被证明的判断" },
];

const PANEL_META = {
  hypothesis: { title: "形成方案", subtitle: "CASE FILE · 假说 v1" },
  stress: { title: "接受审讯", subtitle: "CASE FILE · 压力测试" },
  revise: { title: "作出修正", subtitle: "CASE FILE · 假说 v2" },
  reveal: { title: "谜底与回放", subtitle: "CASE FILE · 监狱长记录" },
  annotations: { title: "我的批注", subtitle: "CASE FILE · 原文标记" },
};

function getAgentNote(progress, stageIndex) {
  if (stageIndex < 1) {
    return "继续往下读，我会等你读完再和你讨论方案。";
  }
  if (!progress.hypothesisV1) {
    return "如果现在必须下注，你认为范·杜森准备怎样逃出十三号牢房？";
  }
  if (!progress.reading.completed) {
    return "第一次判断已封存。带着这个判断，继续读。";
  }
  if (!progress.hypothesisV2) {
    return "我已经追问了方案里的一个默认前提，点击“接受审讯”回应它。";
  }
  return "谜底已解封，点击“谜底与回放”查看完整记录。";
}

function WorkspacePage() {
  const {
    progress,
    answerStatementCard,
    completeReading,
    setCurrentStage,
    submitStressResult,
  } = useProgress();

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
  const [modelStatus, setModelStatus] = useState(null);

  const refreshModelStatus = useCallback(() => {
    getAiStatus()
      .then(setModelStatus)
      .catch(() => {
        setModelStatus({
          api_key_configured: false,
          model: "unknown",
          last_success: false,
          last_error: "status_unavailable",
          last_fallback: true,
        });
      });
  }, []);

  useEffect(() => {
    refreshModelStatus();
  }, [refreshModelStatus]);

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

  const hypothesisUnlocked = stageIndex >= 1;
  const stressUnlocked = Boolean(progress.stressResult);
  const reviseUnlocked = Boolean(progress.stressResult);
  const revealUnlocked = Boolean(progress.hypothesisV2);

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
      done: progress.annotations.length > 0,
    },
  ];

  function handleRetry() {
    setRetryToken((prev) => prev + 1);
    refreshModelStatus();
  }

  async function handleContinue() {
    if (stageIndex === 0) {
      setStageIndex((prev) => prev + 1);
      return;
    }

    if (stageIndex === 1) {
      if (!progress.hypothesisV1) {
        setOpenPanel("hypothesis");
        return;
      }
      setStageIndex(2);
      return;
    }

    if (!progress.hypothesisV1) {
      setOpenPanel("hypothesis");
      return;
    }

    setAiThinking(true);
    setError("");
    try {
      const result = await analyzeHypothesis({
        stageId: 3,
        hypothesisText: progress.hypothesisV1.text,
        confidence: progress.hypothesisV1.confidence,
      });
      submitStressResult(result);
      completeReading();
      refreshModelStatus();
      setOpenPanel("stress");
    } catch {
      setError("UNPROVEN 暂时无法检查你的方案，请确认后端服务正在运行，然后重试。");
    } finally {
      setAiThinking(false);
    }
  }

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

      <AIAgentCard
        status={agentStatus}
        note={getAgentNote(progress, stageIndex)}
        modelStatus={modelStatus}
      />

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

      {loading && !stage && <p className="stageIntro">正在调取档案...</p>}

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
            <div className="checkpointBlock">
              <p className="checkpointLabel">CHECKPOINT 0｜你确定这是“事实”吗？</p>
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
              {allCardsAnswered && (
                <div className="checkpointFeedback">
                  <strong>尚未被证明。</strong>
                  <span>文本证明的是：他进入牢房时没有携带工具。</span>
                  <span>但“之后也不可能获得工具”，已经比文本多走了一步。</span>
                  <span>记住这种差别。继续读。</span>
                </div>
              )}
            </div>
          )}

          {stageId === 2 && (
            <div className="checkpointPrompt">
              <p className="checkpointLabel">CHECKPOINT 1｜第一次判断</p>
              <p>如果现在必须下注——你认为范·杜森准备怎样逃出十三号牢房？</p>
              <p>不要追求猜中。试着说清楚：他准备利用什么？是否需要别人帮助？最后，他本人怎样离开监狱？</p>
            </div>
          )}

          {stageId === 3 && progress.hypothesisV1 && (
            <div className="checkpointPrompt">
              <p className="checkpointLabel">CHECKPOINT 2｜你的解释，还撑得住吗？</p>
              <span className="statementCardId">你之前认为</span>
              <blockquote>“{progress.hypothesisV1.text}”</blockquote>
              <p>从那以后，你又知道了四件事：现金面额发生变化；监狱中出现了“酸”和“八号帽”；监狱没有自己的电工；最后一晚弧光灯真的熄灭了。</p>
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
                {stageIndex === 0
                  ? "继续阅读"
                  : stageIndex === 1
                    ? progress.hypothesisV1
                      ? "带着判断，继续读"
                      : "锁定我的第一次判断"
                    : aiThinking
                      ? "UNPROVEN 正在检查你的方案……"
                      : "检查我的方案"}
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
          analyzeOnSubmit={false}
          onSubmitted={() => {
            setOpenPanel(null);
            setStageIndex(2);
          }}
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
