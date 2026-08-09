import { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import "./pages/pages.css";
import { useProgress } from "./state/ProgressContext";
import { RequireStage } from "./state/RequireStage";
import EntryPage from "./pages/EntryPage";
import WorkspacePage from "./pages/WorkspacePage";

function App() {
  const { progress, resetProgress } = useProgress();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const location = useLocation();
  const isWorkspace = location.pathname === "/workspace";

  function handleResetClick() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    resetProgress();
    setConfirmingReset(false);
  }

  return (
    <main className={`page ${isWorkspace ? "workspaceShell" : ""}`}>
      {!isWorkspace && (
        <nav className="navbar">
          <Link className="brand" to="/">
            UNPROVEN
          </Link>

          {progress.started && (
            <button
              className="statusButton"
              type="button"
              onClick={handleResetClick}
              onBlur={() => setConfirmingReset(false)}
            >
              {confirmingReset ? "确认重置？再点一次" : "重置体验"}
            </button>
          )}
        </nav>
      )}

      <Routes>
        <Route path="/" element={<EntryPage />} />

        <Route
          path="/workspace"
          element={
            <RequireStage isReady={(p) => p.started}>
              <WorkspacePage />
            </RequireStage>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}

export default App;
