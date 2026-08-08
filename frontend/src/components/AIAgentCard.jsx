const STATUS_COPY = {
  online: { dot: "online", label: "在线 · 待命" },
  thinking: { dot: "thinking", label: "正在分析你的方案..." },
  fallback: { dot: "fallback", label: "降级模式 · 使用安全兜底问题" },
  offline: { dot: "offline", label: "无法连接，稍后自动重试" },
};

function getModelStatusLabel(modelStatus) {
  if (!modelStatus) {
    return "AI 状态检测中";
  }
  if (!modelStatus.api_key_configured) {
    return "未配置模型密钥，当前只会使用本地兜底逻辑";
  }
  if (modelStatus.last_success === true && !modelStatus.last_fallback) {
    return `${modelStatus.model} 已完成真实模型调用`;
  }
  if (modelStatus.last_success === false) {
    return `${modelStatus.model} 调用失败，已切换兜底逻辑`;
  }
  return `${modelStatus.model} 已配置，等待首次调用`;
}

function AIAgentCard({ status = "online", note, modelStatus }) {
  const copy = STATUS_COPY[status] || STATUS_COPY.online;

  return (
    <div className="aiAgentCard">
      <div className="aiAgentAvatar">AI</div>
      <div className="aiAgentInfo">
        <div className="aiAgentName">推理陪读 Agent</div>
        <div className="aiAgentStatusRow">
          <span className={`aiAgentDot ${copy.dot}`} />
          <span className="aiAgentStatusLabel">{copy.label}</span>
        </div>
        <p className="aiAgentModelStatus">{getModelStatusLabel(modelStatus)}</p>
        {modelStatus?.last_error && (
          <p className="aiAgentModelError">最近错误：{modelStatus.last_error}</p>
        )}
        {note && <p className="aiAgentNote">{note}</p>}
      </div>
    </div>
  );
}

export default AIAgentCard;
