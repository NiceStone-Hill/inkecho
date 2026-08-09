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


function checkpointDone(
  progress,
  checkpoint,
) {
  if (!checkpoint) {
    return true;
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
    return (
      checkpoint.checkpoint_id
      === "CP3"
        ? Boolean(
            progress.hypothesisV3,
          )
        : Boolean(
            progress.hypothesisV2,
          )
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
      "你的解释又遇到了新的信息，要不要再检查一次？"
    );
  }

  if (
    checkpoint.checkpoint_id ===
    "CP4"
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
        墨
      </div>

      <div
        className="checkpointNotificationBody"
      >
        <div
          className="checkpointNotificationHeader"
        >
          <strong>
            InkEcho
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
        ···
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
            InkEcho问答
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
    hasText(draft.text);


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
          墨
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
        />

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


function PressureCheckpoint({
  progress,
  checkpoint,
  onClose,
}) {
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


  const isSecondRound =
    checkpoint.checkpoint_id
    === "CP3";


  const sourceVersionLabel =
    isSecondRound
      ? "V2"
      : "V1";

  const nextVersionLabel =
    isSecondRound
      ? "V3"
      : "V2";


  const draft =
    isSecondRound
      ? progress.revisionDraft2
      : progress.revisionDraft;


  const stressResult =
    isSecondRound
      ? progress.stressResult2
      : progress.stressResult;


  const stressAnswer =
    isSecondRound
      ? progress.stressAnswer2
      : progress.stressAnswer;


  const updateAnswer =
    isSecondRound
      ? updateStressAnswer2
      : updateStressAnswer;


  const updateDraft =
    isSecondRound
      ? updateRevisionDraft2
      : updateRevisionDraft;


  const submitResult =
    isSecondRound
      ? submitStressResult2
      : submitStressResult;


  const submitNextHypothesis =
    isSecondRound
      ? submitHypothesisV3
      : submitHypothesisV2;


  const completedHypothesis =
    isSecondRound
      ? progress.hypothesisV3
      : progress.hypothesisV2;


  const savedSourceHypothesis =
    isSecondRound
      ? progress.hypothesisV2
      : progress.hypothesisV1;


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
    hasText(
      stressAnswer,
    ) &&
    (
      draft.mode === "keep" ||
      hasText(revisionText)
    );


  const runAnalysis =
    useCallback(
      async () => {
        if (
          !sourceHypothesis ||
          stressResult
        ) {
          return;
        }

        setLoading(true);
        setError("");

        try {
          const result =
            await analyzeHypothesis({
              hypothesisText:
                sourceHypothesis
                  .text,

              confidence:
                sourceHypothesis
                  .confidence,
            });

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
        stressResult,
        sourceHypothesis,
        submitResult,
      ],
    );


  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);


  if (!sourceHypothesis) {
    const canSaveLocal =
      hasText(
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


      if (isSecondRound) {
        submitHypothesisV2({
          ...hypothesis,

          generatedAtCheckpoint:
            true,
        });
      } else {
        submitHypothesisV1({
          ...hypothesis,

          generatedAtCheckpoint:
            true,
        });
      }


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
            墨
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
          />

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
      draft.mode === "keep"
        ? sourceHypothesis
            .confidence
        : draft.confidence;


    submitNextHypothesis({
      checkpointId:
        checkpoint.checkpoint_id,

      text:
        finalText,

      confidence:
        finalConfidence,

      pressureAnswer:
        stressAnswer.trim(),

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
            墨
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
            墨
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
          <div
            className="chatMessage chatMessageAgent"
          >
            <div
              className="chatAvatar"
            >
              墨
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
            className="chatComposer"
          >
            <textarea
              value={
                stressAnswer
              }
              onChange={(event) =>
                updateAnswer(
                  event
                    .target
                    .value,
                )
              }
              placeholder="回复这条消息……"
            />
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
              />

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

    {
      label: "V3",
      value:
        progress.hypothesisV3,
      previous:
        progress.hypothesisV2,
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
          墨
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


function JourneyVersionNode({
  label,
  current,
  previous,
}) {
  if (!current) {
    return null;
  }


  const unchanged =
    previous &&
    current.text ===
      previous.text;


  return (
    <div
      className={
        `journeyNode ${
          unchanged
            ? "journeyNodeUnchanged"
            : ""
        }`
      }
    >
      <div
        className="journeyNodeLabel"
      >
        {label}
      </div>

      {unchanged ? (
        <>
          <strong>
            保留上一版观点
          </strong>

          <p>
            这一轮压力测试没有改变你的核心解释。
          </p>
        </>
      ) : (
        <>
          <strong>
            {
              label === "V1"
                ? "最初的解释"
                : "修正后的解释"
            }
          </strong>

          <p>
            {current.text}
          </p>
        </>
      )}

      {current.confidence && (
        <span
          className="journeyConfidence"
        >
          确信程度：
          {
            current.confidence ===
            "high"
              ? "高"
              : current
                    .confidence ===
                  "low"
                ? "低"
                : "中"
          }
        </span>
      )}
    </div>
  );
}


function JourneyPressureNode({
  label,
  stressResult,
  stressAnswer,
}) {
  if (!stressResult) {
    return null;
  }


  const rationaleEvidence =
    stressResult
      .rationale_evidence_ids ||
    [];


  return (
    <div
      className="journeyPressureNode"
    >
      <div
        className="journeyPressureTop"
      >
        <span>
          {label}
        </span>

        {rationaleEvidence.length >
          0 && (
          <span>
            依据：
            {
              rationaleEvidence.join(
                " · ",
              )
            }
          </span>
        )}
      </div>

      <strong>
        InkEcho 问：
      </strong>

      <p>
        {
          stressResult.pressure_question
        }
      </p>

      {hasText(
        stressAnswer,
      ) && (
        <>
          <strong>
            你的回应：
          </strong>

          <p>
            {stressAnswer}
          </p>
        </>
      )}
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


  return (
    <section
      className="thinkingJourney"
    >
      <div
        className="thinkingJourneyHeader"
      >
        <span>
          YOUR REASONING JOURNEY
        </span>

        <h2>
          你的思路是怎样变化的
        </h2>

        <p>
          这里不是标准答案，
          而是你在阅读过程中留下的推理轨迹。
        </p>
      </div>


      <div
        className="journeyFlow"
      >
        <JourneyVersionNode
          label="V1"
          current={
            progress.hypothesisV1
          }
          previous={null}
        />


        {progress.stressResult && (
          <div
            className="journeyArrow"
          >
            ↓
          </div>
        )}


        <JourneyPressureNode
          label="第一次压力测试"
          stressResult={
            progress.stressResult
          }
          stressAnswer={
            progress.stressAnswer
          }
        />


        {progress.hypothesisV2 && (
          <div
            className="journeyArrow"
          >
            ↓
          </div>
        )}


        <JourneyVersionNode
          label="V2"
          current={
            progress.hypothesisV2
          }
          previous={
            progress.hypothesisV1
          }
        />


        {progress.stressResult2 && (
          <div
            className="journeyArrow"
          >
            ↓
          </div>
        )}


        <JourneyPressureNode
          label="第二次压力测试"
          stressResult={
            progress.stressResult2
          }
          stressAnswer={
            progress.stressAnswer2
          }
        />


        {progress.hypothesisV3 && (
          <div
            className="journeyArrow"
          >
            ↓
          </div>
        )}


        <JourneyVersionNode
          label="V3"
          current={
            progress.hypothesisV3
          }
          previous={
            progress.hypothesisV2
          }
        />


        {hasText(
          progress.completion
            .feedback,
        ) && (
          <>
            <div
              className="journeyArrow"
            >
              ↓
            </div>

            <div
              className="journeyFinalNode"
            >
              <div
                className="journeyNodeLabel"
              >
                FINAL
              </div>

              <strong>
                揭晓前的最终解释
              </strong>

              <p>
                {
                  progress
                    .completion
                    .feedback
                }
              </p>
            </div>
          </>
        )}
      </div>
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


  const stage =
    stagesData[pageId];


  const checkpoint =
    stage?.checkpoint;


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
        aria-label="下一页"
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
              ? "思路历程"
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
                  查看我的思路历程
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
            checkpoint &&
            checkpointDone(
              progress,
              checkpoint,
            )
              ? "思考已记录"
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
        title="InkEcho问答"
        subtitle="ASK ANYTHING"

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
