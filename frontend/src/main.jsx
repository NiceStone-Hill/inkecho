import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { ProgressProvider } from "./state/ProgressContext.jsx";

// 使用 HashRouter 而非 BrowserRouter：GitHub Pages 是纯静态托管，没有服务端路由回退。
// HashRouter 把路由状态放在 URL hash 中（如 /#/read），刷新或直接访问任意子路径
// 都只会请求同一个 index.html，不会触发 404 空白页（对应产品需求文档 AC11）。
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <ProgressProvider>
        <App />
      </ProgressProvider>
    </HashRouter>
  </StrictMode>,
);
