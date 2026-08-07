import { Navigate } from "react-router-dom";
import { useProgress } from "./ProgressContext";
import { getResumeRoute } from "./progress";

export function RequireStage({ isReady, children }) {
  const { progress } = useProgress();

  if (!isReady(progress)) {
    return <Navigate to={getResumeRoute(progress)} replace />;
  }

  return children;
}
