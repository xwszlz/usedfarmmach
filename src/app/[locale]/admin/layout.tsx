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
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const headersList = headers();
  const token = getTokenFromHeaders(headersList);

  if (!token) {
    redirect(`/${locale}/auth/login?redirect=${encodeURIComponent(`/${locale}/admin`)}`);
  }

  const payload = verifyToken(token);
  if (!payload) {
    redirect(`/${locale}/auth/login?redirect=${encodeURIComponent(`/${locale}/admin`)}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true, email: true },
  });

  if (!user || !["admin", "super_admin", "editor"].includes(user.role)) {
    redirect(`/${locale}/auth/login?redirect=${encodeURIComponent(`/${locale}/admin`)}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar role={user.role} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
