import { useEffect, useRef } from "react";

function HandwritingCanvas({
  strokes = [],
  onChange,
  readOnly = false,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef([]);

  function drawAll(savedStrokes = strokes, currentStroke = []) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(
      canvas.width / rect.width,
      canvas.height / rect.height,
    );

    ctx.strokeStyle = "#3f392f";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function drawStroke(stroke) {
      if (!stroke || stroke.length === 0) {
        return;
      }

      ctx.beginPath();

      stroke.forEach((point, index) => {
        const x = point.x * rect.width;
        const y = point.y * rect.height;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      if (stroke.length === 1) {
        const point = stroke[0];
        const x = point.x * rect.width;
        const y = point.y * rect.height;

        ctx.lineTo(x + 0.1, y + 0.1);
      }

      ctx.stroke();
    }

    savedStrokes.forEach(drawStroke);

    if (currentStroke.length > 0) {
      drawStroke(currentStroke);
    }

    ctx.restore();
  }

  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    drawAll();
  }

  useEffect(() => {
    resizeCanvas();

    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      ),
      y: Math.min(
        1,
        Math.max(0, (event.clientY - rect.top) / rect.height),
      ),
    };
  }

  function handlePointerDown(event) {
    if (readOnly) {
      return;
    }

    event.preventDefault();

    event.currentTarget.setPointerCapture(event.pointerId);

    drawingRef.current = true;
    currentStrokeRef.current = [getPoint(event)];

    drawAll(strokes, currentStrokeRef.current);
  }

  function handlePointerMove(event) {
    if (readOnly || !drawingRef.current) {
      return;
    }

    event.preventDefault();

    currentStrokeRef.current.push(getPoint(event));

    drawAll(strokes, currentStrokeRef.current);
  }

  function finishStroke(event) {
    if (readOnly || !drawingRef.current) {
      return;
    }

    event?.preventDefault();

    drawingRef.current = false;

    const completedStroke = [...currentStrokeRef.current];

    if (completedStroke.length > 0) {
      onChange?.([...strokes, completedStroke]);
    }

    currentStrokeRef.current = [];
  }

  return (
    <canvas
      ref={canvasRef}
      className={
        readOnly
          ? "handwritingCanvas handwritingCanvasPreview"
          : "handwritingCanvas"
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
    />
  );
}

export default HandwritingCanvas;