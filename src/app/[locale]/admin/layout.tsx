import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminSidebar } from "./admin-sidebar";

export const dynamic = "force-dynamic";

function getTokenFromHeaders(headersList: Headers) {
  const auth = headersList.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = headersList.get("cookie");
  const m = cookie?.match(/token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const token = getTokenFromHeaders(headersList);

  if (!token) {
    redirect("/");
  }

  const payload = verifyToken(token);
  if (!payload) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  });

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
