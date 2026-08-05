import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrchestratorDashboard } from "@/components/orchestrator/dashboard";

export const metadata = {
  title: "Agent 调度中心 | 神雕农机",
  description: "智能体群协同控制中心",
};

export default async function OrchestratorPage() {
  // Editor 角色不能访问此页面
  const headersList = headers();
  const token = (() => {
    const auth = headersList.get("authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    const cookie = headersList.get("cookie");
    const m = cookie?.match(/token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })();
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
      if (user?.role === "editor") {
        redirect("/admin/products");
      }
    }
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <OrchestratorDashboard />
      </div>
    </div>
  );
}
