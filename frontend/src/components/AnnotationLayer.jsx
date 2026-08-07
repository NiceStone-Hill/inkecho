import { useRef, useState } from "react";
import { useProgress } from "../state/ProgressContext";

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
      nodes.push({ key: `plain-${index}`, text: text.slice(cursor, match.start), annotationId: null });
    }
    nodes.push({
      key: `mark-${index}`,
      text: text.slice(match.start, match.end),
      annotationId: match.annotationId,
    });
    cursor = match.end;
  });
  if (cursor < text.length) {
    nodes.push({ key: "plain-tail", text: text.slice(cursor), annotationId: null });
  }
  return nodes;
}

function AnnotationLayer({ stageId, segments, onOpenAnnotations }) {
  const { progress, addAnnotation } = useProgress();
  const containerRef = useRef(null);
  const [popover, setPopover] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");

  const stageAnnotations = progress.annotations.filter((item) => item.stageId === stageId);

  function handleMouseUp() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
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

    const segmentEl = anchorNode.nodeType === 1
      ? anchorNode.closest("[data-segment-index]")
      : anchorNode.parentElement?.closest("[data-segment-index]");
    if (!segmentEl) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setPopover({
      quote,
      segmentIndex: Number(segmentEl.dataset.segmentIndex),
      top: rect.top - containerRect.top - 46,
      left: Math.max(0, rect.left - containerRect.left),
    });
    setNoteDraft("");
  }

  function handleSaveAnnotation() {
    if (!popover) {
      return;
    }
    addAnnotation({
      stageId,
      segmentIndex: popover.segmentIndex,
      quote: popover.quote,
      note: noteDraft.trim(),
    });
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div className="annotationLayer" ref={containerRef} onMouseUp={handleMouseUp}>
      {segments.map((segment, index) => (
        <p className="segmentBlock" data-segment-index={index} key={index}>
          {buildHighlightedNodes(
            segment,
            stageAnnotations.filter((item) => item.segmentIndex === index),
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
              <span key={node.key}>{node.text}</span>
            ),
          )}
        </p>
      ))}

      {popover && (
        <div
          className="annotationPopover"
          style={{ top: Math.max(0, popover.top), left: popover.left }}
        >
          <p className="annotationPopoverQuote">“{popover.quote}”</p>
          <textarea
            className="annotationPopoverInput"
            autoFocus
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="写下你对这句话的想法（可留空，仅标记）……"
            maxLength={300}
          />
          <div className="annotationPopoverActions">
            <button type="button" className="secondaryButton" onClick={() => setPopover(null)}>
              取消
            </button>
            <button type="button" className="primaryButton" onClick={handleSaveAnnotation}>
              保存批注
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnotationLayer;
