"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Package, Clock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EscrowOrder {
  id: string;
  orderNo: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  disputeStatus: string | null;
  product: { id: string; modelName: string; images: { url: string }[] };
  buyer: { id: string; username: string };
  seller: { id: string; username: string };
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "待支付", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  paid: { label: "已支付", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  escrow: { label: "担保中", color: "bg-green-100 text-green-700", icon: Shield },
  released: { label: "已放款", color: "bg-gray-100 text-gray-700", icon: CheckCircle2 },
  refunded: { label: "已退款", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-500", icon: AlertTriangle },
};

export default function EscrowOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("all");

  useEffect(() => { fetchOrders(); }, [role]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const res = await fetch(`/api/escrow/orders?role=${role}`);
      const data = await res.json();
      if (data.success) setOrders(data.data.orders);
    } catch {}
    finally { setLoading(false); }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-green-600" /> 担保交易
        </h1>
        <div className="flex gap-2">
          {["all", "buyer", "seller"].map((r) => (
            <Button key={r} variant={role === r ? "default" : "outline"} size="sm"
              onClick={() => setRole(r)}>
              {r === "all" ? "全部" : r === "buyer" ? "我买的" : "我卖的"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-20 text-gray-400">
            <Package className="h-12 w-12 mb-3" />
            <p>暂无担保交易订单</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const si = STATUS_MAP[order.paymentStatus] || STATUS_MAP.pending;
            const Icon = si.icon;
            return (
              <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/escrow/${order.id}`)}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                    {order.product.images[0] && (
                      <img src={order.product.images[0].url} alt={order.product.modelName}
                        className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{order.product.modelName}</div>
                    <div className="text-sm text-gray-500 mt-0.5">订单号：{order.orderNo}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium text-green-600">¥{order.amount.toLocaleString()}</span>
                      <Badge className={si.color}>
                        <Icon className="h-3 w-3 mr-1" />{si.label}
                      </Badge>
                      {order.disputeStatus === "opened" && (
                        <Badge className="bg-red-100 text-red-700">争议中</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 text-right flex-shrink-0">
                    {new Date(order.createdAt).toLocaleDateString("zh-CN")}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
