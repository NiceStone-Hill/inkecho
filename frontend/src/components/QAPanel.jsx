import { useState } from "react";
import { useProgress } from "../state/ProgressContext";
import { askQuestionStream } from "../api";

function QAPanel({ stageId = null }) {
  const { progress } = useProgress();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = draft.trim().length > 0 && !loading;

  // 同一时刻只会有一条消息处于 streaming 状态
  // （发送按钮在 loading 期间是禁用的），
  // 所以直接按 streaming 标记定位，不需要额外的 ref。

  function appendDelta(delta) {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.streaming);

      if (index < 0) {
        return prev;
      }

      const next = [...prev];
      next[index] = {
        ...next[index],
        text: next[index].text + delta,
      };
      return next;
    });
  }

  function finishStreamingMessage(text) {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.streaming);

      if (index < 0) {
        return prev;
      }

      const next = [...prev];
      next[index] = {
        ...next[index],
        ...(text !== undefined ? { text } : {}),
        streaming: false,
      };
      return next;
    });
  }

  async function handleSend() {
    const question = draft.trim();

    if (!question || loading) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", text: question },
      { role: "agent", text: "", streaming: true },
    ]);

    setDraft("");
    setLoading(true);
    setError("");

    try {
      await askQuestionStream(
        {
          sessionId: progress.sessionId,
          stageId,
          question,
        },
        {
          onDelta: (delta) => {
            appendDelta(delta);
          },
          onDone: ({ replace, answer }) => {
            finishStreamingMessage(
              replace ? answer : undefined,
            );
          },
        },
      );
    } catch {
      finishStreamingMessage(
        "暂时没能问到答案，请稍后再试。",
      );
      setError("暂时没能问到答案，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <div className="chatMessage chatMessageAgent">
        <div className="chatAvatar">U</div>
        <div className="chatBubble">
          可以问我换算、名词解释这类问题，比如
          「三百英尺是多少米」「牙粉是什么」。
          我不会剧透故事的解法哦。
        </div>
      </div>

      {messages.map((message, index) => (
        <div
          className={`chatMessage ${
            message.role === "user"
              ? "chatMessageUser"
              : "chatMessageAgent"
          }`}
          key={index}
        >
          {message.role === "agent" && (
            <div className="chatAvatar">U</div>
          )}

          <div className="chatBubble">
            {message.streaming && !message.text
              ? "我在想…"
              : message.text}
          </div>
        </div>
      ))}

      {error && (
        <p className="annotationError">{error}</p>
      )}

      <div className="chatComposer">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="想问点什么？"
        />

        <button
          className="primaryButton"
          type="button"
          disabled={!canSubmit}
          onClick={handleSend}
        >
          发送
        </button>
      </div>
    </>
  );
}

export default QAPanel;
