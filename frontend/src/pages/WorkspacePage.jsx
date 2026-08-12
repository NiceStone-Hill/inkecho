import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import "./checkpoint.css";

import {
  useEffect,
} from "react";

import {
  analyzeHypothesis,
  getStage,
} from "../api";

import {
  useProgress,
} from "../state/ProgressContext";

import AnnotationLayer
  from "../components/AnnotationLayer";

import AnnotationsPanel
  from "../components/AnnotationsPanel";

import QAPanel
  from "../components/QAPanel";

import Panel
  from "../components/Panel";


const STAGE_COUNT = 8;
const TOTAL_PAGES = STAGE_COUNT + 1;
const HYPOTHESIS_MIN_LENGTH = 20;
const HYPOTHESIS_MAX_LENGTH = 300;


const CONFIDENCE_OPTIONS = [
  {
    value: "low",
    label: "低",
  },
  {
    value: "medium",
    label: "中",
  },
  {
    value: "high",
    label: "高",
  },
];


function hasText(text) {
  return Boolean(
    text?.trim(),
  );
}


function validHypothesisText(
  text,
) {
  const length =
    text?.trim().length || 0;

  return (
    length >=
      HYPOTHESIS_MIN_LENGTH &&
    length <=
      HYPOTHESIS_MAX_LENGTH
  );
}


function checkpointDone(
  progress,
  checkpoint,
) {
  if (!checkpoint) {
    return true;
  }

  if (
    checkpoint.kind ===
    "training"
  ) {
    return Boolean(
      progress.reading
        .trainingCompleted,
    );
  }

  if (
    checkpoint.kind ===
    "capture"
  ) {
    return Boolean(
      progress.hypothesisV1,
    );
  }

  if (
    checkpoint.kind ===
    "pressure"
  ) {
    return Boolean(
      progress.hypothesisV2,
    );
  }

  return Boolean(
    progress.completion.feedback,
  );
}


function getCheckpointNoticeText(
  checkpoint,
) {
  if (!checkpoint) {
    return "";
  }

  if (
    checkpoint.checkpoint_id ===
    "CP0"
  ) {
    return (
      "在继续推理前，先判断两句话分别是文本事实，还是尚未证明的前提。"
    );
  }

  if (
    checkpoint.checkpoint_id ===
    "CP1"
  ) {
    return (
      "读到这里了。要不要先把你现在的猜想记下来？"
    );
  }

  if (
    checkpoint.checkpoint_id ===
    "CP2"
  ) {
    return (
      "刚刚出现了新的线索。我有一个问题想问你。"
    );
  }

  if (
    checkpoint.checkpoint_id ===
    "CP3"
  ) {
    return (
      "揭晓之前，想看看你现在最完整的解释。"
    );
  }

  return checkpoint.prompt;
}


function CheckpointNotification({
  checkpoint,
  onOpen,
  onClose,
}) {
  if (!checkpoint) {
    return null;
  }

  function handleClose(event) {
    // 防止点击 × 时顺便触发整个气泡的 onOpen
    event.stopPropagation();
    onClose();
  }

  return (
    <div
      className="checkpointNotification"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          onOpen();
        }
      }}
    >
      <div
        className="checkpointNotificationAvatar"
      >
        U
      </div>

      <div
        className="checkpointNotificationBody"
      >
        <div
          className="checkpointNotificationHeader"
        >
          <strong>
            UNPROVEN
          </strong>

          <span>
            刚刚
          </span>
        </div>

        <p>
          {
            getCheckpointNoticeText(
              checkpoint,
            )
          }
        </p>
      </div>

      <span
        className="checkpointNotificationDot"
      />

      <button
        type="button"
        className="checkpointNotificationClose"
        aria-label="关闭提醒"
        onClick={handleClose}
      >
        ×
      </button>
    </div>
  );
}


function FloatingMenu({
  open,
  onToggle,
  onOpenAnnotations,
  onOpenQA,
  onOpenCheckpoint,
  onReset,
}) {
  return (
    <div
      className="readerMenu"
    >
      <button
        type="button"
        className="readerMenuButton"
        aria-label="打开阅读菜单"
        onClick={onToggle}
      >
        <span
          className="readerMenuIcon"
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="readerMenuPanel"
        >
          <button
            type="button"
            onClick={
              onOpenAnnotations
            }
          >
            我的批注
          </button>

          <button
            type="button"
            onClick={onOpenQA}
          >
            阅读问答
          </button>

          <button
            type="button"
            onClick={
              onOpenCheckpoint
            }
          >
            当前思考
          </button>

          <button
            type="button"
            onClick={onReset}
          >
            重置体验
          </button>
        </div>
      )}
    </div>
  );
}


function ConfidenceSelector({
  value,
  onChange,
}) {
  return (
    <div
      className="confidenceGroup"
    >
      {CONFIDENCE_OPTIONS.map(
        (option) => (
          <button
            key={option.value}
            type="button"
            className={
              `optionButton ${
                value ===
                option.value
                  ? "selected"
                  : ""
              }`
            }
            onClick={() =>
              onChange(
                option.value,
              )
            }
          >
            {option.label}
          </button>
        ),
      )}
    </div>
  );
}


function CaptureCheckpoint({
  progress,
  checkpoint,
  onClose,
}) {
  const {
    updateHypothesisDraft,
    submitHypothesisV1,
  } = useProgress();

  const draft =
    progress.hypothesisDraft;

  const canSubmit =
    validHypothesisText(
      draft.text,
    );


  if (
    progress.hypothesisV1
  ) {
    return (
      <div
        className="checkpointReadOnly"
      >
        <div
          className="chatMessage chatMessageUser"
        >
          <div
            className="chatBubble"
          >
            {
              progress
                .hypothesisV1
                .text
            }
          </div>
        </div>

        <button
          className="primaryButton"
          type="button"
          onClick={onClose}
        >
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
      checkpointId:
        checkpoint.checkpoint_id,

      text:
        draft.text.trim(),

      confidence:
        draft.confidence,
    });

    onClose();
  }


  return (
    <>
      <div
        className="chatMessage chatMessageAgent"
      >
        <div
          className="chatAvatar"
        >
          U
        </div>

        <div
          className="chatBubble"
        >
          {checkpoint.prompt}
        </div>
      </div>

      <div
        className="chatComposer"
      >
        <textarea
          value={draft.text}
          onChange={(event) =>
            updateHypothesisDraft({
              text:
                event.target.value,
            })
          }
          placeholder="说说你现在怎么想……"
          maxLength={
            HYPOTHESIS_MAX_LENGTH
          }
        />

        <div className="hypothesisLength">
          <span>
            请用 20–300 字写出一个完整方案
          </span>
          <span>
            {draft.text.trim().length} / {HYPOTHESIS_MAX_LENGTH}
          </span>
        </div>

        <div
          className="chatComposerFooter"
        >
          <span>
            确信程度
          </span>

          <ConfidenceSelector
            value={
              draft.confidence
            }
            onChange={(
              confidence,
            ) =>
              updateHypothesisDraft({
                confidence,
              })
            }
          />
        </div>

        <button
          className="primaryButton"
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          发送
        </button>
      </div>
    </>
  );
}


function TrainingCheckpoint({
  checkpoint,
  onClose,
}) {
  const {
    completeTraining,
  } = useProgress();

  const [
    answers,
    setAnswers,
  ] = useState({});

  const items = [
    {
      id: "entry_tools",
      text: "范·杜森进入十三号牢房时，没有携带锤子、锉刀等普通越狱工具。",
      correct: "fact",
    },
    {
      id: "future_tools",
      text: "因此，在接下来的一周里，他也不可能获得任何可用于越狱的工具。",
      correct: "assumption",
    },
  ];

  const answeredAll =
    items.every(
      (item) =>
        answers[item.id],
    );

  function finishTraining() {
    if (!answeredAll) {
      return;
    }

    completeTraining();
    onClose();
  }

  return (
    <>
      <p className="checkpointPrompt">
        {checkpoint.prompt}
      </p>

      <div className="trainingList">
        {items.map((item, index) => {
          const answer =
            answers[item.id];
          const correct =
            answer === item.correct;

          return (
            <section
              className="trainingItem"
              key={item.id}
            >
              <span>
                0{index + 1}
              </span>

              <p>{item.text}</p>

              <div className="checkpointSwitch">
                <button
                  type="button"
                  className={`optionButton ${answer === "fact" ? "selected" : ""}`}
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [item.id]: "fact",
                    }))
                  }
                >
                  文本已经证明
                </button>

                <button
                  type="button"
                  className={`optionButton ${answer === "assumption" ? "selected" : ""}`}
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [item.id]: "assumption",
                    }))
                  }
                >
                  尚未被证明
                </button>
              </div>

              {answer && (
                <p className={`trainingFeedback ${correct ? "correct" : "incorrect"}`}>
                  {item.id === "entry_tools"
                    ? "这是文本明确写出的入狱状态。"
                    : "文本只证明他入狱时没有工具；“之后也不可能获得”已经多走了一步。"}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <div className="actions">
        <button
          type="button"
          className="primaryButton"
          disabled={!answeredAll}
          onClick={finishTraining}
        >
          记住这种差别，继续阅读
        </button>
      </div>
    </>
  );
}


function PressureCheckpoint({
  progress,
  checkpoint,
  onClose,
}) {
  const {
    submitHypothesisV1,

    submitStressResult,

    updateRevisionDraft,

    submitHypothesisV2,
  } = useProgress();


  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    localHypothesis,
    setLocalHypothesis,
  ] = useState({
    text: "",
    confidence: "medium",
  });

  const [
    localSubmitted,
    setLocalSubmitted,
  ] = useState(null);


  const sourceVersionLabel =
    "V1";

  const nextVersionLabel =
    "V2";


  const draft =
    progress.revisionDraft;


  const stressResult =
    progress.stressResult;


  const updateDraft =
    updateRevisionDraft;


  const submitResult =
    submitStressResult;


  const submitNextHypothesis =
    submitHypothesisV2;


  const completedHypothesis =
    progress.hypothesisV2;


  const savedSourceHypothesis =
    progress.hypothesisV1;


  const sourceHypothesis =
    savedSourceHypothesis ||
    localSubmitted;


  const revisionText =
    draft.mode === "revise"
      ? draft.text
      : (
          sourceHypothesis
            ?.text ||
          ""
        );


  const canSubmit =
    draft.mode === "keep" ||
    validHypothesisText(
      revisionText,
    );


  const runAnalysis =
    useCallback(
      async ({
        force = false,
      } = {}) => {
        if (
          !sourceHypothesis ||
          (
            stressResult &&
            !force
          )
        ) {
          return;
        }

        setLoading(true);
        setError("");

        try {
          const result =
            await analyzeHypothesis({
              sessionId:
                progress.sessionId,

              hypothesisText:
                sourceHypothesis
                  .text,

              confidence:
                sourceHypothesis
                  .confidence,

              force,
            });

          console.log(
            "Pressure Test result:",
            result,
          );

          submitResult(result);
        } catch (
          requestError
        ) {
          console.error(
            requestError,
          );

          setError(
            "暂时无法生成问题，请确认后端服务正在运行。",
          );
        } finally {
          setLoading(false);
        }
      },

      [
        progress.sessionId,
        stressResult,
        sourceHypothesis,
        submitResult,
      ],
    );


  useEffect(() => {
    // 打开压力检查面板后立即发起一次异步分析。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runAnalysis();
  }, [runAnalysis]);


  if (!sourceHypothesis) {
    const canSaveLocal =
      validHypothesisText(
        localHypothesis.text,
      );


    function handleLocalSubmit() {
      if (!canSaveLocal) {
        return;
      }

      const hypothesis = {
        checkpointId:
          checkpoint.checkpoint_id,

        text:
          localHypothesis
            .text
            .trim(),

        confidence:
          localHypothesis
            .confidence,
      };


      submitHypothesisV1({
        ...hypothesis,

        generatedAtCheckpoint:
          true,
      });


      setLocalSubmitted(
        hypothesis,
      );
    }


    return (
      <>
        <div
          className="chatMessage chatMessageAgent"
        >
          <div
            className="chatAvatar"
          >
            U
          </div>

          <div
            className="chatBubble"
          >
            我没有找到你的上一版想法。
            你可以先在这里补写一版，
            然后我们继续。
          </div>
        </div>

        <div
          className="chatComposer"
        >
          <textarea
            value={
              localHypothesis.text
            }
            onChange={(event) =>
              setLocalHypothesis(
                (prev) => ({
                  ...prev,

                  text:
                    event
                      .target
                      .value,
                }),
              )
            }
            placeholder="写下你现在的解释……"
            maxLength={
              HYPOTHESIS_MAX_LENGTH
            }
          />

          <div className="hypothesisLength">
            <span>20–300 字</span>
            <span>
              {localHypothesis.text.trim().length} / {HYPOTHESIS_MAX_LENGTH}
            </span>
          </div>

          <ConfidenceSelector
            value={
              localHypothesis
                .confidence
            }
            onChange={(
              confidence,
            ) =>
              setLocalHypothesis(
                (prev) => ({
                  ...prev,
                  confidence,
                }),
              )
            }
          />

          <button
            className="primaryButton"
            type="button"
            disabled={
              !canSaveLocal
            }
            onClick={
              handleLocalSubmit
            }
          >
            发送
          </button>
        </div>
      </>
    );
  }


  function handleSubmit() {
    if (!canSubmit) {
      return;
    }


    const finalText =
      draft.mode === "keep"
        ? sourceHypothesis.text
        : revisionText.trim();


    const finalConfidence =
      draft.confidence ||
      sourceHypothesis.confidence;


    submitNextHypothesis({
      checkpointId:
        checkpoint.checkpoint_id,

      text:
        finalText,

      confidence:
        finalConfidence,

      pressureAnswer:
        draft.mode === "revise"
          ? revisionText.trim()
          : "",

      revisionType:
        draft.mode === "revise"
          ? "revised"
          : "kept",

      textChanged:
        finalText !==
        sourceHypothesis.text,

      confidenceChanged:
        finalConfidence !==
        sourceHypothesis
          .confidence,
    });


    onClose();
  }


  if (completedHypothesis) {
    const unchanged =
      completedHypothesis.text
      === sourceHypothesis.text;


    return (
      <div
        className="checkpointReadOnly"
      >
        <div
          className="chatMessage chatMessageAgent"
        >
          <div
            className="chatAvatar">
            U
          </div>

          <div
            className="chatBubble"
          >
            {unchanged
              ? `你在 ${nextVersionLabel} 中保留了上一版观点。`
              : `你已经形成了新的 ${nextVersionLabel}。`}
          </div>
        </div>

        {!unchanged && (
          <div
            className="chatMessage chatMessageUser"
          >
            <div
              className="chatBubble"
            >
              {
                completedHypothesis
                  .text
              }
            </div>
          </div>
        )}

        <button
          className="primaryButton"
          type="button"
          onClick={onClose}
        >
          继续阅读
        </button>
      </div>
    );
  }


  return (
    <>
      <div
        className="versionContext"
      >
        <span>
          当前观点 · {
            sourceVersionLabel
          }
        </span>

        <p>
          {
            sourceHypothesis.text
          }
        </p>
      </div>


      {loading && (
        <div
          className="chatMessage chatMessageAgent"
        >
          <div
            className="chatAvatar"
          >
            U
          </div>

          <div
            className="chatBubble"
          >
            我正在看看刚出现的线索……
          </div>
        </div>
      )}


      {error && (
        <p
          className="checkpointError"
        >
          {error}
        </p>
      )}


      {stressResult && (
        <>
          {stressResult.category ===
            "UNCLEAR" && (
            <div
              className="fallbackNotice"
              role="status"
            >
              <strong>
                通用自检
              </strong>

              <p>
                本次未能可靠识别一个个性化前提，下面显示的是通用检查问题，不代表模型已经判断了你的方案。
              </p>

              <button
                type="button"
                className="secondaryButton"
                disabled={loading}
                onClick={() =>
                  runAnalysis({
                    force: true,
                  })
                }
              >
                {loading
                  ? "正在重新检查…"
                  : "重新检查一次"}
              </button>
            </div>
          )}

          <div
            className="chatMessage chatMessageAgent"
          >
            <div
              className="chatAvatar"
            >
              U
            </div>

            <div
              className="chatBubble"
            >
              {
                stressResult.pressure_question
              }
            </div>
          </div>


          <div
            className="revisionChoice"
          >
            <p>
              回答之后，你现在还坚持
              {
                sourceVersionLabel
              }
              吗？
            </p>

            <div
              className="checkpointSwitch"
            >
              <button
                type="button"
                className={
                  `optionButton ${
                    draft.mode !==
                    "revise"
                      ? "selected"
                      : ""
                  }`
                }
                onClick={() =>
                  updateDraft({
                    mode: "keep",
                  })
                }
              >
                我的观点没变
              </button>

              <button
                type="button"
                className={
                  `optionButton ${
                    draft.mode ===
                    "revise"
                      ? "selected"
                      : ""
                  }`
                }
                onClick={() =>
                  updateDraft({
                    mode: "revise",

                    text:
                      draft.text ||
                      sourceHypothesis
                        .text,

                    confidence:
                      draft.confidence ||
                      sourceHypothesis
                        .confidence,
                  })
                }
              >
                我要修改为 {
                  nextVersionLabel
                }
              </button>
            </div>
          </div>


          {draft.mode ===
            "keep" && (
            <div className="keepConfidence">
              <span>
                现在的确信程度
              </span>

              <ConfidenceSelector
                value={
                  draft.confidence ||
                  sourceHypothesis
                    .confidence
                }
                onChange={(
                  confidence,
                ) =>
                  updateDraft({
                    confidence,
                  })
                }
              />
            </div>
          )}


          {draft.mode ===
            "revise" && (
            <div
              className="chatComposer revisionComposer"
            >
              <textarea
                value={
                  draft.text
                }
                onChange={(event) =>
                  updateDraft({
                    text:
                      event
                        .target
                        .value,
                  })
                }
                placeholder={
                  `写下你的 ${nextVersionLabel}……`
                }
                maxLength={
                  HYPOTHESIS_MAX_LENGTH
                }
              />

              <div className="hypothesisLength">
                <span>20–300 字</span>
                <span>
                  {draft.text.trim().length} / {HYPOTHESIS_MAX_LENGTH}
                </span>
              </div>

              <div
                className="chatComposerFooter"
              >
                <span>
                  确信程度
                </span>

                <ConfidenceSelector
                  value={
                    draft.confidence
                  }
                  onChange={(
                    confidence,
                  ) =>
                    updateDraft({
                      confidence,
                    })
                  }
                />
              </div>
            </div>
          )}


          <div
            className="actions"
          >
            <button
              className="primaryButton"
              type="button"
              disabled={
                !canSubmit
              }
              onClick={
                handleSubmit
              }
            >
              发送并继续阅读
            </button>
          </div>
        </>
      )}
    </>
  );
}


function VersionMiniHistory({
  progress,
}) {
  const versions = [
    {
      label: "V1",
      value:
        progress.hypothesisV1,
      previous: null,
    },

    {
      label: "V2",
      value:
        progress.hypothesisV2,
      previous:
        progress.hypothesisV1,
    },

  ];


  return (
    <div
      className="versionMiniHistory"
    >
      {versions.map(
        ({
          label,
          value,
          previous,
        }) => {
          if (!value) {
            return null;
          }


          const unchanged =
            previous &&
            value.text ===
              previous.text;


          return (
            <div
              key={label}
              className={
                `versionMiniItem ${
                  unchanged
                    ? "unchanged"
                    : ""
                }`
              }
            >
              <strong>
                {label}
              </strong>

              {unchanged ? (
                <span>
                  保留上一版
                </span>
              ) : (
                <span>
                  {value.text}
                </span>
              )}
            </div>
          );
        },
      )}
    </div>
  );
}


function FinalCheckpoint({
  progress,
  checkpoint,
  onClose,
}) {
  const {
    submitFeedback,
    markReplayViewed,
  } = useProgress();


  const [
    text,
    setText,
  ] = useState(
    progress.completion
      .feedback ||
    "",
  );


  const canSubmit =
    hasText(text);


  function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    submitFeedback(
      text.trim(),
    );

    markReplayViewed();

    onClose();
  }


  return (
    <>
      <div
        className="chatMessage chatMessageAgent"
      >
        <div
          className="chatAvatar"
        >
          U
        </div>

        <div
          className="chatBubble"
        >
          {checkpoint.prompt}
        </div>
      </div>


      <VersionMiniHistory
        progress={progress}
      />


      <div
        className="chatComposer"
      >
        <textarea
          value={text}
          onChange={(event) =>
            setText(
              event.target.value,
            )
          }
          placeholder="在揭晓之前，写下你现在最完整的解释……"
        />

        <button
          className="primaryButton"
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          提交我的最终推理
        </button>
      </div>
    </>
  );
}


function CheckpointPanel({
  stage,
  progress,
  onClose,
}) {
  const checkpoint =
    stage?.checkpoint;


  if (!checkpoint) {
    return (
      <p
        className="checkpointPrompt"
      >
        当前没有新的消息。
      </p>
    );
  }


  return (
    <div
      className="checkpointContent"
    >
      {
        checkpoint.kind ===
          "training" && (
          <TrainingCheckpoint
            checkpoint={checkpoint}
            onClose={onClose}
          />
        )
      }


      {
        checkpoint.kind ===
          "capture" && (
          <CaptureCheckpoint
            progress={progress}
            checkpoint={
              checkpoint
            }
            onClose={onClose}
          />
        )
      }


      {
        checkpoint.kind ===
          "pressure" && (
          <PressureCheckpoint
            progress={progress}

            checkpoint={
              checkpoint
            }

            onClose={onClose}
          />
        )
      }


      {
        checkpoint.kind ===
          "final" && (
          <FinalCheckpoint
            progress={progress}
            checkpoint={
              checkpoint
            }
            onClose={onClose}
          />
        )
      }
    </div>
  );
}


function ThinkingJourney({
  progress,
}) {
  if (
    !progress.hypothesisV1
  ) {
    return (
      <p
        className="readerMessage"
      >
        完成阅读并提交你的推理方案后，这里会展示你的思路历程。
      </p>
    );
  }

  const branchPoint =
    progress.stressResult
      ?.selected_assumption ||
    "你曾把一条尚未被文本证明的判断，当成了方案成立的条件。";

  const revisionMade =
    Boolean(
      progress.hypothesisV2
        ?.textChanged ||
      progress.hypothesisV2
        ?.confidenceChanged,
    );

  const finalHypothesis =
    hasText(
      progress.completion
        .feedback,
    )
      ? progress.completion
          .feedback
      : progress.hypothesisV2
          ?.text ||
        progress.hypothesisV1
          .text;

  const finalConfidence =
    progress.hypothesisV2
      ?.confidence ||
    progress.hypothesisV1
      .confidence;

  const confidenceLabel = {
    low: "低",
    medium: "中",
    high: "高",
  };

  const categoryLabel = {
    SPACE_PATH: "空间路径",
    HUMAN_PASSAGE: "人员通行",
    TOOL_SOURCE: "工具来源",
    COMMUNICATION: "信息传递",
    INSIDER_HELP: "内部协助",
    UNCLEAR: "通用自检",
  };

  const rationaleEvidence =
    progress.stressResult
      ?.rationale_evidence_ids ||
    [];

  const decisionLabel =
    revisionMade
      ? "修正了原有判断"
      : "看见风险后仍选择保留";


  return (
    <section className="thinkingJourney caseClosure">
      <header className="caseClosureHeader">
        <div>
          <span>UNPROVEN · CASE FILE 013</span>
          <h2>结案档案</h2>
          <p>这不是正确率报告，而是你的判断如何经受证据审查的记录。</p>
        </div>
        <div className="caseClosureStamp">已封存</div>
      </header>

      <div className="caseClosureMeta">
        <div><span>案件</span><strong>第十三号牢房</strong></div>
        <div><span>推理版本</span><strong>{progress.hypothesisV2 ? "V1 → V2" : "V1"}</strong></div>
        <div><span>审查证据</span><strong>{rationaleEvidence.length ? rationaleEvidence.join(" · ") : "E01–E03"}</strong></div>
        <div><span>审查结果</span><strong>发现 1 项关键前提</strong></div>
      </div>

      <section className="caseClosureFinding">
        <span>01 · 关键分叉点</span>
        <h3>{branchPoint}</h3>
        <p>{revisionMade
          ? "你在压力问题之后重新检查了这一步，并调整了解释或确信程度。"
          : "你辨认出这一步尚未被文本证明，并在知晓风险后保留了原来的解释。"}</p>
      </section>

      <section className="caseClosureSection">
        <div className="caseClosureSectionTitle">
          <span>02</span>
          <div><h3>判断变化</h3><p>对照最初解释与审查后的选择</p></div>
        </div>
        <div className="caseClosureCompare">
          <article>
            <div className="caseClosureVersion"><span>HYPOTHESIS</span><strong>V1</strong></div>
            <p>{progress.hypothesisV1.text}</p>
            <small>确信程度：{confidenceLabel[progress.hypothesisV1.confidence] || "中"}</small>
          </article>
          <div className="caseClosureDecision">
            <span>审查后</span>
            <strong>{revisionMade ? "修正" : "保留"}</strong>
          </div>
          <article className="caseClosureFinalVersion">
            <div className="caseClosureVersion"><span>AFTER REVIEW</span><strong>{progress.hypothesisV2 ? "V2" : "V1"}</strong></div>
            <p>{progress.hypothesisV2?.text || progress.hypothesisV1.text}</p>
            <small>确信程度：{confidenceLabel[finalConfidence] || "中"}</small>
          </article>
        </div>
        <p className="caseClosureDecisionNote">本轮决定：{decisionLabel}</p>
      </section>

      {progress.stressResult && (
        <section className="caseClosureSection">
          <div className="caseClosureSectionTitle">
            <span>03</span>
            <div><h3>压力测试记录</h3><p>AI 只审查未证前提，不判断答案对错</p></div>
          </div>
          <div className="caseClosureAudit">
            <div className="caseClosureAuditTags">
              <span>{categoryLabel[progress.stressResult.category] || "未证前提"}</span>
              <span>{rationaleEvidence.length ? `依据 ${rationaleEvidence.join(" · ")}` : "通用自检"}</span>
            </div>
            <div className="caseClosureQuestion">
              <span>PRESSURE QUESTION</span>
              <p>{progress.stressResult.pressure_question}</p>
            </div>
            {hasText(progress.stressAnswer) && (
              <div className="caseClosureResponse">
                <span>你的回应</span>
                <p>{progress.stressAnswer}</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="caseClosureSealed">
        <div className="caseClosureSeal">FINAL</div>
        <div>
          <span>04 · 揭晓前封存</span>
          <h3>我的最终逃脱路径</h3>
          <p>{finalHypothesis}</p>
        </div>
      </section>

      <footer className="caseClosureFooter">
        <strong>UNPROVEN</strong>
        <span>文本证明到哪里，你的判断就从哪里开始。</span>
      </footer>
    </section>
  );
}


function WorkspacePage() {

  const [
  checkpointNoticeDismissed,
  setCheckpointNoticeDismissed,
  ] = useState(false);

  const {
  progress,
  setCurrentStage,
  completeReading,
  resetProgress,

  submitStressResult,
} = useProgress();


  const initialPage =
    Math.min(
      TOTAL_PAGES,

      Math.max(
        1,

        progress.reading
          .currentStageId ||
          1,
      ),
    );


  const [
    pageId,
    setPageId,
  ] = useState(
    initialPage,
  );


  const [
    stagesData,
    setStagesData,
  ] = useState({});


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  const [
    openPanel,
    setOpenPanel,
  ] = useState(null);


  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);


  const [
    touchStartX,
    setTouchStartX,
  ] = useState(null);


  const ebookSurfaceRef =
    useRef(null);

  const pressurePrefetchRef =
    useRef(new Set());


  const stage =
    stagesData[pageId];


  const checkpoint =
    stage?.checkpoint;

  useEffect(() => {
  if (
    !stage ||
    !checkpoint ||
    checkpoint.kind !== "pressure"
  ) {
    return;
  }

  const sourceHypothesis =
    progress.hypothesisV1;

  const existingResult =
    progress.stressResult;

  if (
    !sourceHypothesis ||
    existingResult
  ) {
    return;
  }

  const prefetchKey =
    `${checkpoint.checkpoint_id}:${sourceHypothesis.text}`;

  if (
    pressurePrefetchRef.current.has(
      prefetchKey,
    )
  ) {
    return;
  }

  pressurePrefetchRef.current.add(
    prefetchKey,
  );

  console.log(
    "Prefetch Pressure Test:",
    checkpoint.checkpoint_id,
  );

  analyzeHypothesis({
    sessionId:
      progress.sessionId,

    stageId: stage.stage_id,

    hypothesisText:
      sourceHypothesis.text,

    confidence:
      sourceHypothesis.confidence,
  })
    .then((result) => {
      console.log(
        "Pressure Test prefetched:",
        result,
      );

      submitStressResult(
        result,
      );
    })
    .catch((error) => {
      console.error(
        "Pressure Test prefetch failed:",
        error,
      );

      pressurePrefetchRef.current.delete(
        prefetchKey,
      );
    });
}, [
  stage,
  checkpoint,

  progress.hypothesisV1,
  progress.sessionId,

  progress.stressResult,

  submitStressResult,
]);


  const showCheckpointNotice =
  checkpoint &&
  !checkpointDone(
    progress,
    checkpoint,
  ) &&
  openPanel !== "checkpoint" &&
  !checkpointNoticeDismissed;

  // 每到一个新的 checkpoint，重新允许气泡出现
  useEffect(() => {
    // checkpoint 变化时生成一条新的、可关闭的提醒。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckpointNoticeDismissed(false);
  }, [
    checkpoint?.checkpoint_id,
  ]);


  // 气泡出现 15 秒后自动消失
  useEffect(() => {
    if (!showCheckpointNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCheckpointNoticeDismissed(true);
    }, 30000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    showCheckpointNotice,
    checkpoint?.checkpoint_id,
  ]);
    

  useEffect(() => {
    let cancelled =
      false;

    if (
      pageId >
      STAGE_COUNT
    ) {
      // 推理档案是本地汇总页，不需要等待后端内容。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      setError("");

      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError("");


    getStage(pageId)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setStagesData(
          (prev) => ({
            ...prev,

            [pageId]:
              data,
          }),
        );

        setCurrentStage(
          pageId,
        );


        if (
          pageId ===
          STAGE_COUNT
        ) {
          completeReading();
        }
      })

      .catch(() => {
        if (!cancelled) {
          setError(
            "暂时无法读取文本，请确认后端服务正在运行。",
          );
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
  }, [
    pageId,
    setCurrentStage,
    completeReading,
  ]);


  /*
   * 注意：
   *
   * 原来的代码这里有一个 useEffect，
   * 到 checkpoint 就自动：
   *
   * setOpenPanel("checkpoint")
   *
   * 现在故意删除。
   *
   * Checkpoint 只发消息提醒，
   * 用户点击后才打开。
   */


  // 每次翻页（无论前进还是后退），
  // 阅读区域都滚动回顶部
  useEffect(() => {
    ebookSurfaceRef.current?.scrollTo({
      top: 0,
    });
  }, [pageId]);


  const canPrev =
    pageId > 1;


  const canNext =
    pageId <
    TOTAL_PAGES;


  const checkpointBlocking =
    Boolean(
      checkpoint &&
      !checkpointDone(
        progress,
        checkpoint,
      ),
    );


  const pageLabel =
    useMemo(
      () =>
        `${String(
          pageId,
        ).padStart(
          2,
          "0",
        )} / ${String(
          TOTAL_PAGES,
        ).padStart(
          2,
          "0",
        )}`,

      [pageId],
    );


  function turnPage(
    direction,
  ) {
    if (
      direction > 0 &&
      checkpointBlocking
    ) {
      setMenuOpen(false);
      setCheckpointNoticeDismissed(true);
      setOpenPanel("checkpoint");
      return;
    }

    setMenuOpen(false);
    setOpenPanel(null);

    setPageId(
      (prev) => {
        const next =
          prev +
          direction;

        return Math.min(
          TOTAL_PAGES,

          Math.max(
            1,
            next,
          ),
        );
      },
    );
  }


  function goToPage(
    target,
  ) {
    setMenuOpen(false);
    setOpenPanel(null);

    setPageId(
      Math.min(
        TOTAL_PAGES,

        Math.max(
          1,
          target,
        ),
      ),
    );
  }


  function handleTouchEnd(
    event,
  ) {
    if (
      touchStartX ===
      null
    ) {
      return;
    }


    const delta =
      event
        .changedTouches[0]
        .clientX -
      touchStartX;


    if (
      Math.abs(delta) >
      55
    ) {
      turnPage(
        delta < 0
          ? 1
          : -1,
      );
    }


    setTouchStartX(
      null,
    );
  }


  function handleOpenCheckpoint() {
    setMenuOpen(false);

    setOpenPanel(
      "checkpoint",
    );
  }


  return (
    <section
      className={
        `readerPage ${
          openPanel ===
          "checkpoint"
            ? "checkpointDocked"
            : ""
        }`
      }

      onTouchStart={(
        event,
      ) =>
        setTouchStartX(
          event
            .touches[0]
            .clientX,
        )
      }

      onTouchEnd={
        handleTouchEnd
      }
    >
      <FloatingMenu
        open={menuOpen}

        onToggle={() =>
          setMenuOpen(
            (prev) =>
              !prev,
          )
        }

        onOpenAnnotations={() => {
          setMenuOpen(false);

          setOpenPanel(
            "annotations",
          );
        }}

        onOpenQA={() => {
          setMenuOpen(false);

          setOpenPanel("qa");
        }}

        onOpenCheckpoint={
          handleOpenCheckpoint
        }

        onReset={() => {
          setMenuOpen(false);

          resetProgress();

          setPageId(1);

          setOpenPanel(null);
        }}
      />


      {showCheckpointNotice && (
        <CheckpointNotification
          checkpoint={checkpoint}

          onOpen={() => {
            setCheckpointNoticeDismissed(true);
            handleOpenCheckpoint();
          }}

          onClose={() => {
            setCheckpointNoticeDismissed(true);
          }}
        />
      )}


      <button
        type="button"
        className="pageTurnButton pageTurnPrev"
        aria-label="上一页"
        disabled={!canPrev}
        onClick={() =>
          turnPage(-1)
        }
      >
        ‹
      </button>


      <button
        type="button"
        className="pageTurnButton pageTurnNext"
        aria-label={
          checkpointBlocking
            ? "完成当前思考后继续"
            : "下一页"
        }
        disabled={!canNext}
        onClick={() =>
          turnPage(1)
        }
      >
        ›
      </button>


      <main
        ref={ebookSurfaceRef}
        className="ebookSurface"
      >
        <div
          className="ebookTopline"
        >
          <span>
            {pageId ===
            TOTAL_PAGES
              ? "推理档案"
              : "第十三号牢房"}
          </span>

          <span>
            {pageLabel}
          </span>
        </div>


        {loading &&
          !stage && (
          <p
            className="readerMessage"
          >
            正在翻开这一页...
          </p>
        )}


        {error && (
          <p
            className="readerMessage readerError"
          >
            {error}
          </p>
        )}


        {stage &&
          !error &&
          pageId <=
            STAGE_COUNT && (
          <>
            <h1
              className="ebookTitle"
            >
              {stage.title}
            </h1>

            <AnnotationLayer
              stageId={
                pageId
              }

              segments={
                stage.segments
              }

              onOpenAnnotations={() =>
                setOpenPanel(
                  "annotations",
                )
              }
            />

            {pageId ===
              STAGE_COUNT && (
              <div
                className="viewJourneyRow"
              >
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() =>
                    goToPage(
                      TOTAL_PAGES,
                    )
                  }
                >
                  查看我的推理档案
                </button>
              </div>
            )}
          </>
        )}


        {pageId ===
          TOTAL_PAGES && (
          <ThinkingJourney
            progress={
              progress
            }
          />
        )}
      </main>


      <div
        className="readerFooter"
      >
        <span>
          {
            checkpoint
              ? checkpointBlocking
                ? "完成当前思考后继续"
                : "思考已记录"
              : ""
          }
        </span>

        <span>
          {pageLabel}
        </span>
      </div>


      <Panel
        title={
          checkpoint?.title ||
          "当前思考"
        }

        subtitle={
          checkpoint
            ? checkpoint
                .checkpoint_id
            : "READING"
        }

        open={
          openPanel ===
          "checkpoint"
        }

        onClose={() =>
          setOpenPanel(null)
        }

        variant="side"
      >
        <CheckpointPanel
          stage={stage}

          progress={
            progress
          }

          onClose={() =>
            setOpenPanel(
              null,
            )
          }
        />
      </Panel>


      <Panel
        title="我的批注"
        subtitle="READING NOTES"

        open={
          openPanel ===
          "annotations"
        }

        onClose={() =>
          setOpenPanel(null)
        }
      >
        <AnnotationsPanel />
      </Panel>


      <Panel
        title="阅读问答"
        subtitle="READER ASSISTANT"

        open={
          openPanel === "qa"
        }

        onClose={() =>
          setOpenPanel(null)
        }

        variant="side"
      >
        <QAPanel
          stageId={
            pageId <= STAGE_COUNT
              ? pageId
              : null
          }
        />
      </Panel>
    </section>
  );
}


export default WorkspacePage;
