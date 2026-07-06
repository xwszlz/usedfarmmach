"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Shield, Clock, CheckCircle2, AlertTriangle, Truck, Loader2, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface OrderDetail {
  id: string;
  orderNo: string;
  amount: number;
  platformFee: number;
  sellerAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  paidAt: string | null;
  escrowStartedAt: string | null;
  releasedAt: string | null;
  buyerConfirmed: boolean;
  buyerConfirmedAt: string | null;
  autoReleaseAt: string | null;
  deliveryCompany: string | null;
  trackingNo: string | null;
  shippedAt: string | null;
  disputeStatus: string | null;
  disputeReason: string | null;
  product: { id: string; modelName: string; images: { url: string }[] };
  buyer: { id: string; username: string };
  seller: { id: string; username: string };
}

export default function EscrowOrderDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.id as string;
  const codeUrl = searchParams.get("code_url");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => { fetchOrder(); fetchUser(); }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success) setCurrentUserId(data.data.id);
    } catch {}
  }

  async function fetchOrder() {
    setLoading(true);
    try {
      const res = await fetch(`/api/escrow/orders/${orderId}`);
      const data = await res.json();
      if (data.success) setOrder(data.data);
      else setMsg({ type: "error", text: data.error });
    } catch {
      setMsg({ type: "error", text: "加载订单失败" });
    } finally { setLoading(false); }
  }

  async function handleConfirmReceipt() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/escrow/orders/${orderId}/confirm`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        fetchOrder();
      } else setMsg({ type: "error", text: data.error });
    } catch { setMsg({ type: "error", text: "操作失败" }); }
    finally { setActionLoading(false); }
  }

  async function handleDispute() {
    if (!disputeReason.trim()) { setMsg({ type: "error", text: "请填写争议原因" }); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/escrow/orders/${orderId}/dispute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: disputeReason }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        setShowDispute(false); fetchOrder();
      } else setMsg({ type: "error", text: data.error });
    } catch { setMsg({ type: "error", text: "操作失败" }); }
    finally { setActionLoading(false); }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  if (!order) {
    return (
      <div className="container mx-auto py-20 text-center">
        <p className="text-gray-400">订单不存在或无权查看</p>
        <Link href="/escrow"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" /> 返回列表</Button></Link>
      </div>
    );
  }

  const isBuyer = currentUserId === order.buyer.id;
  const isSeller = currentUserId === order.seller.id;

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: "待支付", color: "bg-yellow-100 text-yellow-700" },
    paid: { label: "已支付", color: "bg-blue-100 text-blue-700" },
    escrow: { label: "担保中", color: "bg-green-100 text-green-700" },
    released: { label: "已放款", color: "bg-gray-100 text-gray-700" },
    refunded: { label: "已退款", color: "bg-red-100 text-red-700" },
    cancelled: { label: "已取消", color: "bg-gray-100 text-gray-500" },
  };
  const si = statusMap[order.paymentStatus] || statusMap.pending;

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <Link href="/escrow" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> 返回担保交易列表
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-green-600" /> 担保交易详情
        </h1>
        <Badge className={si.color}>{si.label}</Badge>
      </div>

      {/* 消息提示 */}
      {msg && (
        <div className={`rounded-lg p-3 mb-4 text-sm ${msg.type === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {msg.text}
        </div>
      )}

      {/* 微信支付二维码 */}
      {codeUrl && order.paymentStatus === "pending" && (
        <Card className="mb-4 border-green-200">
          <CardContent className="flex flex-col items-center py-6">
            <p className="font-medium text-green-700 mb-3">请使用微信扫码支付</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(codeUrl)}`}
              alt="微信支付二维码" className="w-60 h-60 border rounded-lg" />
            <p className="text-sm text-gray-500 mt-3">支付金额：¥{order.amount.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">支付完成后页面将自动更新</p>
          </CardContent>
        </Card>
      )}

      {/* 订单信息 */}
      <Card className="mb-4">
        <CardHeader><CardTitle>订单信息</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">订单号</span><span className="font-mono">{order.orderNo}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">交易金额</span><span className="font-bold text-green-600">¥{order.amount.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">平台手续费</span><span>¥{order.platformFee.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">卖家到账</span><span>¥{order.sellerAmount.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">支付方式</span><span>{order.paymentMethod === "wechat" ? "微信支付" : "支付宝"}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">创建时间</span><span>{new Date(order.createdAt).toLocaleString("zh-CN")}</span></div>
        </CardContent>
      </Card>

      {/* 产品信息 */}
      <Card className="mb-4">
        <CardHeader><CardTitle>交易设备</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
              {order.product.images[0] && <img src={order.product.images[0].url} alt={order.product.modelName} className="w-full h-full object-cover" />}
            </div>
            <div>
              <div className="font-medium">{order.product.modelName}</div>
              <Link href={`/products/${order.product.id}`} className="text-sm text-blue-600 hover:underline">查看产品详情</Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 交易流程时间线 */}
      <Card className="mb-4">
        <CardHeader><CardTitle>交易流程</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <TimelineItem icon={Clock} label="创建订单" time={order.createdAt} done={true} />
          <TimelineItem icon={CheckCircle2} label="买家支付" time={order.paidAt} done={!!order.paidAt} />
          <TimelineItem icon={Shield} label="进入担保期" time={order.escrowStartedAt} done={!!order.escrowStartedAt} />
          {order.deliveryCompany && <TimelineItem icon={Truck} label={`卖家发货：${order.deliveryCompany} ${order.trackingNo || ""}`} time={order.shippedAt} done={!!order.shippedAt} />}
          <TimelineItem icon={CheckCircle2} label="买家确认收货" time={order.buyerConfirmedAt} done={order.buyerConfirmed} />
          <TimelineItem icon={Shield} label="放款给卖家" time={order.releasedAt} done={!!order.releasedAt} />
        </CardContent>
      </Card>

      {/* 争议信息 */}
      {order.disputeStatus === "opened" && (
        <Card className="mb-4 border-red-200">
          <CardHeader><CardTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> 交易争议</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{order.disputeReason}</p>
            <p className="text-xs text-gray-400 mt-2">平台将在1-3个工作日内介入处理</p>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      {order.paymentStatus === "escrow" && (
        <Card>
          <CardContent className="py-4 space-y-3">
            {isBuyer && !order.buyerConfirmed && (
              <>
                <Button onClick={handleConfirmReceipt} disabled={actionLoading} className="w-full bg-green-600 hover:bg-green-700 text-white">
                  {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  确认收货
                </Button>
                <Button onClick={() => setShowDispute(!showDispute)} variant="outline" className="w-full text-red-600 border-red-300 hover:bg-red-50">
                  <AlertTriangle className="h-4 w-4 mr-2" /> 发起交易争议
                </Button>
                {showDispute && (
                  <div className="space-y-2">
                    <textarea className="w-full border rounded-lg p-2 text-sm" placeholder="请详细描述争议原因..." value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={3} />
                    <Button onClick={handleDispute} disabled={actionLoading} variant="destructive" className="w-full">提交争议</Button>
                  </div>
                )}
              </>
            )}
            {isBuyer && order.buyerConfirmed && !order.releasedAt && (
              <div className="text-center text-sm text-gray-500 py-2">
                <Clock className="h-5 w-5 mx-auto mb-2 text-gray-400" />
                已确认收货，{order.autoReleaseAt ? new Date(order.autoReleaseAt).toLocaleDateString("zh-CN") : "3天后"}自动放款给卖家
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TimelineItem({ icon: Icon, label, time, done }: { icon: any; label: string; time: string | null; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-300"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1"><span className={done ? "text-gray-900" : "text-gray-400"}>{label}</span></div>
      {time && <span className="text-xs text-gray-400">{new Date(time).toLocaleString("zh-CN")}</span>}
    </div>
  );
}
