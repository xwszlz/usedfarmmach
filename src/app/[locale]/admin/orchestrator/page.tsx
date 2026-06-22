import { OrchestratorDashboard } from "@/components/orchestrator/dashboard";

export const metadata = {
  title: "Agent 调度中心 | 神雕农机",
  description: "智能体群协同控制中心",
};

export default function OrchestratorPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <OrchestratorDashboard />
      </div>
    </div>
  );
}
