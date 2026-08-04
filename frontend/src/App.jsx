import { useState } from "react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [backendStatus, setBackendStatus] = useState("尚未检查");
  const [loading, setLoading] = useState(false);

  function createLocalEcho() {
    const cleanedText = text.trim();

    if (!cleanedText) {
      setResult("请先输入一些文字。");
      return;
    }

    setResult(`这是前端本地生成的回声：${cleanedText}`);
  }

  async function checkBackend() {
    setLoading(true);
    setBackendStatus("正在连接……");

    try {
      const response = await fetch(`${API_URL}/api/health`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setBackendStatus(`连接成功：${data.status}`);
    } catch (error) {
      console.error(error);
      setBackendStatus("连接失败，请检查后端是否启动");
    } finally {
      setLoading(false);
    }
  }

  async function createBackendEcho() {
    const cleanedText = text.trim();

    if (!cleanedText) {
      setResult("请先输入一些文字。");
      return;
    }

    setLoading(true);
    setResult("正在请求后端……");

    try {
      const response = await fetch(`${API_URL}/api/echo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleanedText,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult(data.reply);
    } catch (error) {
      console.error(error);
      setResult("请求失败，请确认本地后端正在运行。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <nav className="navbar">
        <a className="brand" href="/">
          Inkecho
        </a>

        <button
          className="statusButton"
          type="button"
          onClick={checkBackend}
          disabled={loading}
        >
          检查后端
        </button>
      </nav>

      <section className="hero">
        <p className="eyebrow">WRITE · REFLECT · ECHO</p>

        <h1>
          Let your words
          <br />
          leave an echo.
        </h1>

        <p className="introduction">
          写下一段不想忘记的文字，让 Inkecho 帮你保存、整理并重新发现它。
        </p>

        <div className="editor">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="写下一段此刻不想忘记的文字……"
          />

          <div className="actions">
            <button
              className="secondaryButton"
              type="button"
              onClick={createLocalEcho}
            >
              前端测试
            </button>

            <button
              className="primaryButton"
              type="button"
              onClick={createBackendEcho}
              disabled={loading}
            >
              {loading ? "处理中……" : "请求后端"}
            </button>
          </div>
        </div>

        {result && <div className="result">{result}</div>}

        <div className="backendStatus">
          <span className="statusDot" />
          后端状态：{backendStatus}
        </div>
      </section>
    </main>
  );
}

export default App;