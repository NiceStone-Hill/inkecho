const STATUS_COPY = {
  online: { dot: "online", label: "在线 · 待命" },
  thinking: { dot: "thinking", label: "正在分析你的方案……" },
  fallback: { dot: "fallback", label: "降级模式 · 使用安全兜底问题" },
  offline: { dot: "offline", label: "无法连接，稍后自动重试" },
};

function AIAgentCard({ status = "online", note }) {
  const copy = STATUS_COPY[status] || STATUS_COPY.online;

  return (
    <div className="aiAgentCard">
      <div className="aiAgentAvatar">AI</div>
      <div className="aiAgentInfo">
        <div className="aiAgentName">审讯官 · AI</div>
        <div className="aiAgentStatusRow">
          <span className={`aiAgentDot ${copy.dot}`} />
          <span className="aiAgentStatusLabel">{copy.label}</span>
        </div>
        {note && <p className="aiAgentNote">{note}</p>}
      </div>
    </div>
  );
}

export default AIAgentCard;
