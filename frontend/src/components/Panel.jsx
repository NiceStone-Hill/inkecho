import { useEffect } from "react";

function Panel({ title, subtitle, open, onClose, children, variant = "modal" }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className={`panelOverlay ${variant === "side" ? "panelOverlaySide" : ""}`} onClick={onClose}>
      <div
        className={`panelSheet ${variant === "side" ? "panelSheetSide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panelHeader">
          <div>
            <span className="caseNumber">{subtitle}</span>
            <h2 className="panelTitle">{title}</h2>
          </div>
          <button
            className="panelCloseButton"
            type="button"
            onClick={onClose}
            aria-label="关闭面板"
          >
            ×
          </button>
        </div>
        <div className="panelBody">{children}</div>
      </div>
    </div>
  );
}

export default Panel;
