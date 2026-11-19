import { StrictMode, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { DatasetProvider } from "@/lib/dataset";
import { startCommuteBoot } from "@/lib/commuteState";
import { startIncomeBoot } from "@/lib/incomeState";
import { isPaired } from "@/lib/serverClient";
import { bootApi, subscribeToken } from "@/lib/session";
import { ErrorBoundary } from "@/shell/ErrorBoundary";
import { LoginGate } from "@/shell/LoginGate";
import "@/styles/index.css";

bootApi();
startIncomeBoot();
startCommuteBoot();

/** 进应用先登录：没令牌就停在登录页，登录成功（令牌落地）才挂工作台。 */
function Root() {
  const paired = useSyncExternalStore(subscribeToken, isPaired, isPaired);
  return paired ? <App /> : <LoginGate />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root 不存在");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <DatasetProvider>
        <Root />
      </DatasetProvider>
    </ErrorBoundary>
  </StrictMode>,
);
