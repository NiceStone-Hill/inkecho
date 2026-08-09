import { useState } from "react";
import { useProgress } from "../state/ProgressContext";
import { askQuestion } from "../api";

function QAPanel({ stageId = null }) {
  const { progress } = useProgress();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = draft.trim().length > 0 && !loading;

  async function handleSend() {
    const question = draft.trim();

    if (!question || loading) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", text: question },
    ]);

    setDraft("");
    setLoading(true);
    setError("");

    try {
      const result = await askQuestion({
        sessionId: progress.sessionId,
        stageId,
        question,
      });

      setMessages((prev) => [
        ...prev,
        { role: "agent", text: result.answer },
      ]);
    } catch {
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
        <div className="chatAvatar">墨</div>
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
            <div className="chatAvatar">墨</div>
          )}

          <div className="chatBubble">{message.text}</div>
        </div>
      ))}

      {loading && (
        <div className="chatMessage chatMessageAgent">
          <div className="chatAvatar">墨</div>
          <div className="chatBubble">我在想…</div>
        </div>
      )}

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
