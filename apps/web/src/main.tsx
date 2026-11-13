import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { DatasetProvider } from "@/lib/dataset";
import { bootApi } from "@/lib/session";
import { ErrorBoundary } from "@/shell/ErrorBoundary";
import "@/styles/index.css";

bootApi();

const root = document.getElementById("root");
if (!root) throw new Error("#root 不存在");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <DatasetProvider>
        <App />
      </DatasetProvider>
    </ErrorBoundary>
  </StrictMode>,
);
