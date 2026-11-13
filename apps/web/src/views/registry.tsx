import type { ReactNode } from "react";
import { CommuteView } from "./desktop/CommuteView";
import { ComponentsView } from "./desktop/ComponentsView";
import { GuideView } from "./desktop/GuideView";
import { ProfileView } from "./desktop/ProfileView";
import { CmScreen } from "./mobile/CmScreen";
import { CpScreen } from "./mobile/CpScreen";
import { DetScreen } from "./mobile/DetScreen";
import { GdScreen } from "./mobile/GdScreen";
import { MeScreen } from "./mobile/MeScreen";
import { MyScreen } from "./mobile/MyScreen";
import { OvScreen } from "./mobile/OvScreen";
import { SlScreen } from "./mobile/SlScreen";
import type { DesktopView } from "@/shell/nav";

export const DESKTOP_VIEWS: Record<DesktopView, () => ReactNode> = {
  guide: () => <GuideView />,
  commute: () => <CommuteView />,
  components: () => <ComponentsView />,
  profile: () => <ProfileView />,
};

export const MOBILE_SCREENS: Array<{ key: string; node: ReactNode }> = [
  { key: "gd", node: <GdScreen /> },
  { key: "ov", node: <OvScreen /> },
  { key: "cm", node: <CmScreen /> },
  { key: "det", node: <DetScreen /> },
  { key: "sl", node: <SlScreen /> },
  { key: "my", node: <MyScreen /> },
  { key: "cp", node: <CpScreen /> },
  { key: "me", node: <MeScreen /> },
];
