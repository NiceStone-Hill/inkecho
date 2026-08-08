import { useRef, useState } from "react";
import { useProgress } from "../state/ProgressContext";
import HandwritingCanvas from "./HandwritingCanvas";

function buildHighlightedNodes(text, annotations) {
  if (annotations.length === 0) {
    return [{ key: "plain", text, annotationId: null }];
  }

  const matches = [];

  for (const annotation of annotations) {
    const index = text.indexOf(annotation.quote);

    if (index >= 0) {
      matches.push({
        start: index,
        end: index + annotation.quote.length,
        annotationId: annotation.id,
      });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const nodes = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.start < cursor) {
      return;
    }

    if (match.start > cursor) {
      nodes.push({
        key: `plain-${index}`,
        text: text.slice(cursor, match.start),
        annotationId: null,
      });
    }

    nodes.push({
      key: `mark-${index}`,
      text: text.slice(match.start, match.end),
      annotationId: match.annotationId,
    });

    cursor = match.end;
  });

  if (cursor < text.length) {
    nodes.push({
      key: "plain-tail",
      text: text.slice(cursor),
      annotationId: null,
    });
  }

  return nodes;
}

function AnnotationLayer({
  stageId,
  segments,
  onOpenAnnotations,
}) {
  const { progress, addAnnotation } = useProgress();

  const containerRef = useRef(null);

  const [popover, setPopover] = useState(null);

  // 键盘批注内容
  const [noteDraft, setNoteDraft] = useState("");

  // text = 键盘输入
  // draw = 手写输入
  const [annotationMode, setAnnotationMode] = useState("text");

  // 保存手写笔迹
  const [strokes, setStrokes] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stageAnnotations = progress.annotations.filter(
    (item) => item.stageId === stageId,
  );

  function handleMouseUp() {
    const selection = window.getSelection();

    if (
      !selection ||
      selection.isCollapsed ||
      saving
    ) {
      return;
    }

    const quote = selection.toString().trim();

    if (!quote || quote.length > 200) {
      selection.removeAllRanges();
      return;
    }

    const anchorNode = selection.anchorNode;
    const container = containerRef.current;

    if (!container || !container.contains(anchorNode)) {
      return;
    }

    const segmentEl =
      anchorNode.nodeType === 1
        ? anchorNode.closest("[data-segment-index]")
        : anchorNode.parentElement?.closest(
            "[data-segment-index]",
          );

    if (!segmentEl) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect =
      container.getBoundingClientRect();

    const popoverWidth = 320;
    const popoverHeight = annotationMode === "draw" ? 250 : 210;
    const rawTop =
      rect.top -
      containerRect.top -
      46;
    const rawLeft = rect.left - containerRect.left;

    setPopover({
      quote,
      segmentIndex: Number(
        segmentEl.dataset.segmentIndex,
      ),
      top: Math.min(
        Math.max(0, rawTop),
        Math.max(0, containerRect.height - popoverHeight),
      ),
      left: Math.min(
        Math.max(0, rawLeft),
        Math.max(0, containerRect.width - popoverWidth - 12),
      ),
    });

    // 每次新建批注时恢复默认状态
    setNoteDraft("");
    setAnnotationMode("text");
    setStrokes([]);
    setError("");
  }

  async function handleSaveAnnotation() {
    if (!popover) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await addAnnotation({
        stageId,
        segmentIndex: popover.segmentIndex,
        quote: popover.quote,

        note:
          annotationMode === "text"
            ? noteDraft.trim()
            : "",

        inputMode: annotationMode,

        strokes:
          annotationMode === "draw"
            ? strokes
            : [],
      });

      setPopover(null);
      setNoteDraft("");
      setStrokes([]);
      setAnnotationMode("text");

      window
        .getSelection()
        ?.removeAllRanges();
    } catch {
      setError(
        "批注保存失败，请确认后端服务正在运行。",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setPopover(null);
    setNoteDraft("");
    setStrokes([]);
    setAnnotationMode("text");
    setError("");

    window
      .getSelection()
      ?.removeAllRanges();
  }

  return (
    <div
      className="annotationLayer"
      ref={containerRef}
      onMouseUp={handleMouseUp}
    >
      {segments.map((segment, index) => (
        <p
          className="segmentBlock"
          data-segment-index={index}
          key={index}
        >
          {buildHighlightedNodes(
            segment,
            stageAnnotations.filter(
              (item) =>
                item.segmentIndex === index,
            ),
          ).map((node) =>
            node.annotationId ? (
              <mark
                className="annotationMark"
                key={node.key}
                title="点击查看批注"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenAnnotations?.();
                }}
              >
                {node.text}
              </mark>
            ) : (
              <span key={node.key}>
                {node.text}
              </span>
            ),
          )}
        </p>
      ))}

      {popover && (
        <div
          className="annotationPopover"
          style={{
            top: Math.max(0, popover.top),
            left: popover.left,
          }}
          onMouseUp={(event) =>
            event.stopPropagation()
          }
        >
          <p className="annotationPopoverQuote">
            “{popover.quote}”
          </p>

          <div className="annotationModeSwitch">
            <button
              type="button"
              className={
                annotationMode === "text"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAnnotationMode("text")
              }
            >
              ⌨ 键盘
            </button>

            <button
              type="button"
              className={
                annotationMode === "draw"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAnnotationMode("draw")
              }
            >
              ✎ 手写
            </button>
          </div>

          {annotationMode === "text" ? (
            <textarea
              className="annotationPopoverInput"
              autoFocus
              value={noteDraft}
              onChange={(event) =>
                setNoteDraft(
                  event.target.value,
                )
              }
              placeholder="写下你对这句话的想法（可留空，仅高亮标记）..."
              maxLength={300}
            />
          ) : (
            <div className="handwritingArea">
              <HandwritingCanvas
                strokes={strokes}
                onChange={setStrokes}
              />

              <div className="handwritingTools">
                <span>
                  用鼠标、触摸或触控笔书写
                </span>

                <button
                  type="button"
                  className="handwritingClearButton"
                  onClick={() =>
                    setStrokes([])
                  }
                  disabled={
                    strokes.length === 0
                  }
                >
                  清空
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="annotationError">
              {error}
            </p>
          )}

          <div className="annotationPopoverActions">
            <button
              type="button"
              className="secondaryButton"
              disabled={saving}
              onClick={handleCancel}
            >
              取消
            </button>

            <button
              type="button"
              className="primaryButton"
              disabled={saving}
              onClick={handleSaveAnnotation}
            >
              {saving
                ? "保存中..."
                : "保存批注"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnotationLayer;
