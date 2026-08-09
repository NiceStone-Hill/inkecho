import {
  useRef,
  useState,
} from "react";

import {
  useProgress,
} from "../state/ProgressContext";

import {
  recognizeHandwriting,
} from "../api";

import HandwritingCanvas
  from "./HandwritingCanvas";


/* ========================================
   strokes -> PNG
   ======================================== */

function strokesToImageDataUrl(
  strokes,
) {
  const width = 640;
  const height = 180;

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width = width;
  canvas.height = height;

  const ctx =
    canvas.getContext("2d");


  // 白底
  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    width,
    height,
  );


  // 黑字
  ctx.strokeStyle =
    "#111111";

  ctx.lineWidth = 5;

  ctx.lineCap =
    "round";

  ctx.lineJoin =
    "round";


  for (
    const stroke
    of strokes
  ) {

    if (
      !stroke ||
      stroke.length === 0
    ) {
      continue;
    }

    ctx.beginPath();


    stroke.forEach(
      (
        point,
        index,
      ) => {

        const x =
          point.x *
          width;

        const y =
          point.y *
          height;


        if (
          index === 0
        ) {

          ctx.moveTo(
            x,
            y,
          );

        } else {

          ctx.lineTo(
            x,
            y,
          );

        }
      },
    );


    if (
      stroke.length === 1
    ) {

      const point =
        stroke[0];

      ctx.lineTo(
        point.x *
          width +
          1,

        point.y *
          height +
          1,
      );
    }


    ctx.stroke();
  }


  return canvas.toDataURL(
    "image/png",
  );
}


/* ========================================
   Highlight text
   ======================================== */

function buildHighlightedNodes(
  text,
  segmentIndex,
  annotations,
) {
  if (
    annotations.length === 0
  ) {
    return [
      {
        key: "plain",
        text,
        annotationId: null,
      },
    ];
  }


  const matches = [];


  for (
    const annotation
    of annotations
  ) {

    /*
     * 跨段批注的 quote 是拼接后的完整文字，
     * 不能直接拿它去当前这一段里 indexOf。
     * 高亮用的文字要取这一段自己的 span。
     */

    const span =
      (
        annotation.spans ||
        []
      ).find(
        (item) =>
          item.segmentIndex ===
          segmentIndex,
      );

    const spanQuote =
      span
        ? span.quote
        : annotation.quote;

    const index =
      text.indexOf(
        spanQuote,
      );


    if (index >= 0) {

      matches.push({
        start: index,

        end:
          index +
          spanQuote.length,

        annotationId:
          annotation.id,
      });

    }
  }


  matches.sort(
    (a, b) =>
      a.start - b.start,
  );


  const nodes = [];

  let cursor = 0;


  matches.forEach(
    (
      match,
      index,
    ) => {

      if (
        match.start <
        cursor
      ) {
        return;
      }


      if (
        match.start >
        cursor
      ) {

        nodes.push({
          key:
            `plain-${index}`,

          text:
            text.slice(
              cursor,
              match.start,
            ),

          annotationId:
            null,
        });

      }


      nodes.push({
        key:
          `mark-${index}`,

        text:
          text.slice(
            match.start,
            match.end,
          ),

        annotationId:
          match.annotationId,
      });


      cursor =
        match.end;
    },
  );


  if (
    cursor <
    text.length
  ) {

    nodes.push({
      key:
        "plain-tail",

      text:
        text.slice(
          cursor,
        ),

      annotationId:
        null,
    });

  }


  return nodes;
}


/* ========================================
   AnnotationLayer
   ======================================== */

function AnnotationLayer({
  stageId,
  segments,
  onOpenAnnotations,
}) {

  const {
    progress,
    addAnnotation,
  } = useProgress();


  const containerRef =
    useRef(null);


  const [
    popover,
    setPopover,
  ] = useState(null);


  const [
    noteDraft,
    setNoteDraft,
  ] = useState("");


  const [
    annotationMode,
    setAnnotationMode,
  ] = useState(
    "text",
  );


  const [
    strokes,
    setStrokes,
  ] = useState([]);


  const [
    recognizing,
    setRecognizing,
  ] = useState(false);


  const [
    ocrReady,
    setOcrReady,
  ] = useState(false);


  const [
    ocrConfidence,
    setOcrConfidence,
  ] = useState(null);


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");


  const stageAnnotations =
    progress.annotations.filter(
      (item) =>
        item.stageId ===
        stageId,
    );


  function resetDraft() {

    setNoteDraft("");

    setAnnotationMode(
      "text",
    );

    setStrokes([]);

    setRecognizing(
      false,
    );

    setOcrReady(
      false,
    );

    setOcrConfidence(
      null,
    );

    setError("");
  }


  function handleMouseUp() {

    const selection =
      window.getSelection();


    if (
      !selection ||
      selection.isCollapsed ||
      saving
    ) {
      return;
    }


    const quote =
      selection
        .toString()
        .trim();


    if (
      !quote ||
      quote.length > 600
    ) {

      selection
        .removeAllRanges();

      return;
    }


    const container =
      containerRef.current;


    if (
      !container ||
      !container.contains(
        selection.anchorNode,
      )
    ) {
      return;
    }


    setError("");


    const range =
      selection.getRangeAt(0);


    /*
     * 用 range 的 start / end 容器判断，
     * 而不是 selection.anchorNode。
     *
     * anchorNode 只是用户拖动选区的起点，
     * 反向选择（从后往前拖）时，
     * anchorNode 可能落在选区末尾的段落里，
     * 用它来定位段落是不准确的。
     */

    function resolveSegmentElement(
      node,
    ) {
      return node.nodeType === 1

        ? node.closest(
            "[data-segment-index]",
          )

        : node
            .parentElement
            ?.closest(
              "[data-segment-index]",
            );
    }


    const startEl =
      resolveSegmentElement(
        range.startContainer,
      );

    const endEl =
      resolveSegmentElement(
        range.endContainer,
      );


    if (!startEl || !endEl) {
      return;
    }


    const startSegmentIndex =
      Number(
        startEl.dataset
          .segmentIndex,
      );

    const endSegmentIndex =
      Number(
        endEl.dataset
          .segmentIndex,
      );


    if (
      endSegmentIndex <
      startSegmentIndex
    ) {
      return;
    }


    /*
     * 允许跨段落批注：
     * 依次为区间内的每一段，
     * 各自截取被选中的那部分文字，
     * 存进 spans。
     *
     * 后端会用 spans 里每一段的文字，
     * 分别校验它确实属于对应段落，
     * 而不是把整段选区文字
     * 硬塞进单一段落里匹配。
     */

    const spans = [];

    for (
      let segmentIndex =
        startSegmentIndex;
      segmentIndex <=
        endSegmentIndex;
      segmentIndex++
    ) {

      const segmentEl =
        container.querySelector(
          `[data-segment-index="${segmentIndex}"]`,
        );

      if (!segmentEl) {
        continue;
      }

      const segmentRange =
        document.createRange();

      if (
        segmentIndex ===
        startSegmentIndex
      ) {

        segmentRange.setStart(
          range.startContainer,
          range.startOffset,
        );

      } else {

        segmentRange.setStart(
          segmentEl,
          0,
        );
      }

      if (
        segmentIndex ===
        endSegmentIndex
      ) {

        segmentRange.setEnd(
          range.endContainer,
          range.endOffset,
        );

      } else {

        segmentRange.setEnd(
          segmentEl,
          segmentEl.childNodes
            .length,
        );
      }

      const segmentQuote =
        segmentRange
          .toString()
          .trim();

      if (segmentQuote) {

        spans.push({
          segmentIndex,
          quote: segmentQuote,
        });
      }
    }


    if (spans.length === 0) {

      selection
        .removeAllRanges();

      return;
    }


    const rect =
      range
        .getBoundingClientRect();

    const containerRect =
      container
        .getBoundingClientRect();


    const popoverWidth =
      320;

    // 手写识别增加了一些内容，
    // 所以统一多留空间。
    const popoverHeight =
      390;


    const rawTop =
      rect.top -
      containerRect.top -
      46;


    const rawLeft =
      rect.left -
      containerRect.left;


    setPopover({
      quote,

      segmentIndex:
        startSegmentIndex,

      segmentEndIndex:
        endSegmentIndex,

      spans,

      top:
        Math.min(
          Math.max(
            0,
            rawTop,
          ),

          Math.max(
            0,

            containerRect.height -
            popoverHeight,
          ),
        ),

      left:
        Math.min(
          Math.max(
            0,
            rawLeft,
          ),

          Math.max(
            0,

            containerRect.width -
            popoverWidth -
            12,
          ),
        ),
    });


    resetDraft();
  }


  async function handleRecognize() {

    if (
      strokes.length === 0
    ) {

      setError(
        "请先写一些内容。",
      );

      return;
    }


    setRecognizing(
      true,
    );

    setError("");


    try {

      const imageDataUrl =
        strokesToImageDataUrl(
          strokes,
        );


      const result =
        await recognizeHandwriting(
          imageDataUrl,
        );


      setNoteDraft(
        result.transcript,
      );


      setOcrConfidence(
        result.confidence,
      );


      setOcrReady(
        true,
      );


      if (
        !result.transcript
      ) {

        setError(
          "没有识别出文字，你可以在下面直接输入。",
        );

      }

    } catch (err) {

      console.error(
        err,
      );


      // 即使 OCR 出错，
      // 也允许用户手动输入。
      setOcrReady(
        true,
      );


      setOcrConfidence(
        null,
      );


      setError(
        "识别失败，你可以直接在下面输入文字。",
      );

    } finally {

      setRecognizing(
        false,
      );

    }
  }


  async function handleSaveAnnotation() {

    if (!popover) {
      return;
    }


    if (
      annotationMode ===
        "draw" &&
      strokes.length >
        0 &&
      !ocrReady
    ) {

      setError(
        "请先点击“识别文字”，这样后面的 Agent 才能理解你的手写批注。",
      );

      return;
    }


    setSaving(true);

    setError("");


    try {

      await addAnnotation({
        stageId,

        segmentIndex:
          popover.segmentIndex,

        segmentEndIndex:
          popover.segmentEndIndex,

        quote:
          popover.quote,

        spans:
          popover.spans,


        /*
         * 关键：
         *
         * 不管键盘还是手写，
         * 最终文字都保存到 note。
         *
         * 所以后面的 Agent
         * 完全不用修改。
         */
        note:
          noteDraft.trim(),


        inputMode:
          annotationMode,


        strokes:
          annotationMode ===
          "draw"

            ? strokes

            : [],
      });


      setPopover(null);

      resetDraft();


      window
        .getSelection()
        ?.removeAllRanges();

    } catch (err) {

      console.error(
        err,
      );


      setError(
        "批注保存失败，请确认后端服务正在运行。",
      );

    } finally {

      setSaving(
        false,
      );

    }
  }


  function handleCancel() {

    setPopover(null);

    resetDraft();


    window
      .getSelection()
      ?.removeAllRanges();
  }


  function switchMode(
    mode,
  ) {

    setAnnotationMode(
      mode,
    );


    // 输入方式改变，
    // 清掉上一种输入的内容。
    setNoteDraft("");

    setOcrReady(
      false,
    );

    setOcrConfidence(
      null,
    );

    setError("");
  }


  return (
    <div
      className="annotationLayer"

      ref={
        containerRef
      }

      onMouseUp={
        handleMouseUp
      }
    >

      {segments.map(
        (
          segment,
          index,
        ) => (

          <p
            className="segmentBlock"

            data-segment-index={
              index
            }

            key={
              index
            }
          >

            {buildHighlightedNodes(
              segment,

              index,

              stageAnnotations.filter(
                (item) =>
                  item.segmentIndex <=
                    index &&
                  item.segmentEndIndex >=
                    index,
              ),
            ).map(
              (node) =>

                node.annotationId
                  ? (

                    <mark
                      className="annotationMark"

                      key={
                        node.key
                      }

                      title="点击查看批注"

                      onClick={(
                        event,
                      ) => {

                        event
                          .stopPropagation();

                        onOpenAnnotations
                          ?.();
                      }}
                    >
                      {
                        node.text
                      }
                    </mark>

                  )

                  : (

                    <span
                      key={
                        node.key
                      }
                    >
                      {
                        node.text
                      }
                    </span>

                  ),
            )}

          </p>

        ),
      )}


      {!popover &&
        error && (

        <p
          className="annotationError annotationErrorStandalone"
        >
          {error}
        </p>

      )}


      {popover && (

        <div
          className="annotationPopover"

          style={{
            top:
              Math.max(
                0,
                popover.top,
              ),

            left:
              popover.left,
          }}

          onMouseUp={(
            event,
          ) =>
            event
              .stopPropagation()
          }
        >

          <p
            className="annotationPopoverQuote"
          >
            “{popover.quote}”
          </p>


          <div
            className="annotationModeSwitch"
          >

            <button
              type="button"

              className={
                annotationMode ===
                "text"
                  ? "active"
                  : ""
              }

              onClick={() =>
                switchMode(
                  "text",
                )
              }
            >
              ⌨ 键盘
            </button>


            <button
              type="button"

              className={
                annotationMode ===
                "draw"
                  ? "active"
                  : ""
              }

              onClick={() =>
                switchMode(
                  "draw",
                )
              }
            >
              ✎ 手写
            </button>

          </div>


          {annotationMode ===
          "text" ? (

            <textarea
              className="annotationPopoverInput"

              autoFocus

              value={
                noteDraft
              }

              onChange={(
                event,
              ) =>
                setNoteDraft(
                  event
                    .target
                    .value,
                )
              }

              placeholder="写下你对这句话的想法（可留空，仅高亮标记）..."

              maxLength={
                300
              }
            />

          ) : (

            <div
              className="handwritingArea"
            >

              <HandwritingCanvas
                strokes={
                  strokes
                }

                onChange={(
                  nextStrokes,
                ) => {

                  setStrokes(
                    nextStrokes,
                  );


                  /*
                   * 笔迹发生变化后，
                   * 原识别结果失效。
                   */

                  setOcrReady(
                    false,
                  );

                  setOcrConfidence(
                    null,
                  );

                  setNoteDraft("");

                  setError("");
                }}
              />


              <div
                className="handwritingTools"
              >

                <span>
                  建议写一行简短批注
                </span>


                <button
                  type="button"

                  className="handwritingClearButton"

                  onClick={() => {

                    setStrokes(
                      [],
                    );

                    setNoteDraft("");

                    setOcrReady(
                      false,
                    );

                    setOcrConfidence(
                      null,
                    );

                  }}

                  disabled={
                    strokes.length ===
                    0
                  }
                >
                  清空
                </button>

              </div>


              <div
                className="annotationPopoverActions"
              >

                <button
                  type="button"

                  className="secondaryButton"

                  disabled={
                    recognizing ||
                    strokes.length ===
                    0
                  }

                  onClick={
                    handleRecognize
                  }
                >

                  {
                    recognizing
                      ? "识别中..."
                      : ocrReady
                        ? "重新识别"
                        : "识别文字"
                  }

                </button>

              </div>


              {ocrReady && (

                <div>

                  <p
                    className="annotationOcrLabel"
                  >
                    识别结果

                    {
                      ocrConfidence !==
                        null && (
                        <span>
                          {" "}
                          · 置信度{" "}
                          {
                            Math.round(
                              ocrConfidence *
                              100,
                            )
                          }%
                        </span>
                      )
                    }
                  </p>


                  <textarea
                    className="annotationPopoverInput"

                    value={
                      noteDraft
                    }

                    onChange={(
                      event,
                    ) =>
                      setNoteDraft(
                        event
                          .target
                          .value,
                      )
                    }

                    placeholder="如果识别不准确，可以直接修改这里的文字。"

                    maxLength={
                      300
                    }
                  />

                </div>

              )}

            </div>

          )}


          {error && (

            <p
              className="annotationError"
            >
              {error}
            </p>

          )}


          <div
            className="annotationPopoverActions"
          >

            <button
              type="button"

              className="secondaryButton"

              disabled={
                saving ||
                recognizing
              }

              onClick={
                handleCancel
              }
            >
              取消
            </button>


            <button
              type="button"

              className="primaryButton"

              disabled={
                saving ||
                recognizing
              }

              onClick={
                handleSaveAnnotation
              }
            >
              {
                saving
                  ? "保存中..."
                  : "保存批注"
              }
            </button>

          </div>

        </div>

      )}

    </div>
  );
}


export default AnnotationLayer;