import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MessageSquare, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [productCount, inquiryCount, userCount] = await Promise.all([
    prisma.product.count(),
    prisma.inquiry.count(),
    prisma.user.count(),
  ]);

  const recentProducts = await prisma.product.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      brand: true,
      category: true,
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-primary-100 p-3">
              <Package className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Products</p>
              <p className="text-2xl font-bold">{productCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-blue-100 p-3">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Inquiries</p>
              <p className="text-2xl font-bold">{inquiryCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-green-100 p-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Users</p>
              <p className="text-2xl font-bold">{userCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Products */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 font-medium">Brand</th>
                  <th className="pb-2 font-medium">Year</th>
                  <th className="pb-2 font-medium">Price (CNY)</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentProducts.map((product) => (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{product.modelName}</td>
                    <td className="py-2 text-gray-500">{product.brand.nameEn}</td>
                    <td className="py-2 text-gray-500">{product.year}</td>
                    <td className="py-2">¥{product.priceCny.toLocaleString()}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          product.status === "active"
                            ? "bg-green-100 text-green-700"
                            : product.status === "sold"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
