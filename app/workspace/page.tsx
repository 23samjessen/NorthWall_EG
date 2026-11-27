import { requireChatGPTUser } from '@/hostinger/native/site-auth';
import Workspace from "@/components/workspace";
import "./workspace.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team workspace · NorthWallEg",
  robots: { index: false, follow: false },
};

export default async function WorkspacePage() { await requireChatGPTUser('/workspace');
  return <Workspace />;
}
