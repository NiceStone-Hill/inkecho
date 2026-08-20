import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/noto-serif-sc";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-700.css";
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
