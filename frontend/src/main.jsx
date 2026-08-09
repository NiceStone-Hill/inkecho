import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { ProgressProvider } from "./state/ProgressContext.jsx";

createRoot(document.getElementById("root")).render(
  <HashRouter>
    <ProgressProvider>
      <App />
    </ProgressProvider>
  </HashRouter>,
);
