"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCode, ShieldCheck, History, MapPin, Calendar, Factory, ScanLine, CheckCircle2, Clock } from "lucide-react";

interface MachineryEvent {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  operator: string | null;
  location: string | null;
  eventDate: string;
}

interface MachineryIdentity {
  id: string;
  qrCode: string;
  serialNo: string | null;
  manufactureDate: string | null;
  factoryName: string | null;
  factoryLocation: string | null;
  verifyHash: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  events: MachineryEvent[];
}

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  manufactured: { label: "出厂", color: "bg-blue-100 text-blue-700" },
  listed: { label: "上架", color: "bg-green-100 text-green-700" },
  inspected: { label: "检测", color: "bg-yellow-100 text-yellow-700" },
  traded: { label: "交易", color: "bg-purple-100 text-purple-700" },
  exported: { label: "出口", color: "bg-indigo-100 text-indigo-700" },
  maintained: { label: "维保", color: "bg-orange-100 text-orange-700" },
  transferred: { label: "过户", color: "bg-gray-100 text-gray-700" },
};

export function MachineryIdentityCard({ productId, locale }: { productId: string; locale: string }) {
  const [identity, setIdentity] = useState<MachineryIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const isZh = locale === "zh";

  useEffect(() => {
    fetchIdentity();
  }, [productId]);

  async function fetchIdentity() {
    setLoading(true);
    try {
      const res = await fetch(`/api/machinery/identity?productId=${productId}`);
      const data = await res.json();
      if (data.success) {
        setIdentity(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function generateIdentity() {
    setGenerating(true);
    try {
      const res = await fetch("/api/machinery/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (data.success) {
        setIdentity(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-400">
          {isZh ? "加载农机档案中..." : "Loading machinery profile..."}
        </CardContent>
      </Card>
    );
  }

  // 尚未生成一机一码
  if (!identity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            {isZh ? "一机一码身份溯源" : "Machinery Identity & Traceability"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4">
            <ShieldCheck className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {isZh ? "该设备尚未生成一机一码" : "No identity code generated yet"}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {isZh
                  ? "生成后可获得唯一QR码，买家扫码可查看设备全生命周期档案"
                  : "Generate a unique QR code for buyers to trace full lifecycle history"}
              </p>
            </div>
          </div>
          <Button onClick={generateIdentity} disabled={generating} className="w-full">
            <QrCode className="mr-2 h-4 w-4" />
            {generating
              ? isZh ? "生成中..." : "Generating..."
              : isZh ? "生成一机一码" : "Generate Identity Code"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 已有一机一码
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          {isZh ? "一机一码身份溯源" : "Machinery Identity & Traceability"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* QR码与验证状态 */}
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-28 w-28 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
              <div className="text-center">
                <ScanLine className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-1 text-xs font-mono font-bold text-gray-600">{identity.qrCode}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">{isZh ? "扫码验真" : "Scan to verify"}</p>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {identity.isVerified ? (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {isZh ? "已验证" : "Verified"}
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700">
                  <Clock className="mr-1 h-3 w-3" />
                  {isZh ? "待验证" : "Pending"}
                </Badge>
              )}
            </div>
            {identity.serialNo && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">{isZh ? "出厂编号" : "Serial No."}:</span>
                <span className="font-medium text-gray-800">{identity.serialNo}</span>
              </div>
            )}
            {identity.factoryName && (
              <div className="flex items-center gap-2 text-sm">
                <Factory className="h-4 w-4 text-gray-400" />
                <span className="text-gray-800">{identity.factoryName}</span>
                {identity.factoryLocation && (
                  <span className="text-gray-400">({identity.factoryLocation})</span>
                )}
              </div>
            )}
            {identity.manufactureDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-800">
                  {isZh ? "出厂日期" : "Mfg Date"}: {identity.manufactureDate}
                </span>
              </div>
            )}
            {identity.verifyHash && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <ShieldCheck className="h-3 w-3" />
                <span className="font-mono">Hash: {identity.verifyHash}</span>
              </div>
            )}
          </div>
        </div>

        {/* 生命周期时间线 */}
        {identity.events.length > 0 && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <History className="h-4 w-4" />
              {isZh ? "生命周期档案" : "Lifecycle History"}
              <Badge variant="secondary">{identity.events.length}</Badge>
            </h4>
            <div className="space-y-3">
              {identity.events.map((event, idx) => {
                const typeInfo = EVENT_TYPE_LABELS[event.eventType] || { label: event.eventType, color: "bg-gray-100 text-gray-700" };
                return (
                  <div key={event.id} className="flex gap-3">
                    {/* 时间线轴 */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${typeInfo.color}`}>
                        {idx + 1}
                      </div>
                      {idx < identity.events.length - 1 && (
                        <div className="mt-1 h-full w-0.5 flex-1 bg-gray-200" style={{ minHeight: "20px" }} />
                      )}
                    </div>
                    {/* 事件内容 */}
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                        <span className="text-sm font-medium text-gray-800">{event.title}</span>
                      </div>
                      {event.description && (
                        <p className="mt-1 text-xs text-gray-500">{event.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                        <span>{new Date(event.eventDate).toLocaleDateString(isZh ? "zh-CN" : "en-US")}</span>
                        {event.operator && <span>· {event.operator}</span>}
                        {event.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
