import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { bootApi } from "@/lib/session";
import "@/styles/index.css";

bootApi();

const root = document.getElementById("root");
if (!root) throw new Error("#root 不存在");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
