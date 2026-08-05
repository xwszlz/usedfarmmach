"use client";

import { useState, useEffect } from "react";

interface BlockchainRecord {
  id: string;
  blockIndex: number;
  previousHash: string;
  currentHash: string;
  eventType: string;
  eventData: any;
  timestamp: string;
  operatorName: string | null;
  isVerified: boolean;
}

interface ChainVerification {
  allBlocksVerified: boolean;
  blockDetails: Array<{
    blockIndex: number;
    eventType: string;
    hashValid: boolean;
    chainLinkValid: boolean;
    isVerified: boolean;
  }>;
  message: string;
}

const eventTypeMap: Record<string, { zh: string; en: string; icon: string }> = {
  created: { zh: "产品上架", en: "Listed", icon: "📋" },
  inspected: { zh: "检验完成", en: "Inspected", icon: "🔍" },
  transferred: { zh: "产权转移", en: "Transferred", icon: "🔄" },
  maintained: { zh: "维修保养", en: "Maintained", icon: "🔧" },
  sold: { zh: "成交售出", en: "Sold", icon: "💰" },
  exported: { zh: "出口报关", en: "Exported", icon: "🚢" },
};

export default function BlockchainTrace({ productId, locale = "zh" }: { productId: string; locale?: string }) {
  const [records, setRecords] = useState<BlockchainRecord[]>([]);
  const [verification, setVerification] = useState<ChainVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchTrace();
  }, [productId]);

  const fetchTrace = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blockchain/verify?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.chain || []);
        setVerification(data.verification || null);
      }
    } catch (e) {
      console.error("Failed to fetch blockchain trace:", e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
        {locale === "zh" ? "加载溯源链..." : "Loading trace..."}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
        {locale === "zh" ? "暂无溯源记录" : "No traceability records"}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⛓️</span>
            <div>
              <h3 className="font-bold text-lg">
                {locale === "zh" ? "区块链溯源" : "Blockchain Traceability"}
              </h3>
              <p className="text-purple-100 text-sm">
                {locale === "zh" ? "不可篡改的设备生命周期记录" : "Tamper-proof lifecycle records"}
              </p>
            </div>
          </div>
          {verification && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              verification.allBlocksVerified ? "bg-green-400 text-green-900" : "bg-red-400 text-red-900"
            }`}>
              {verification.allBlocksVerified ? "✓ " + (locale === "zh" ? "已验证" : "Verified") : "⚠ " + (locale === "zh" ? "验证失败" : "Failed")}
            </div>
          )}
        </div>
      </div>

      {/* Chain */}
      <div className="p-5">
        <div className={`space-y-0 ${!expanded && records.length > 4 ? "max-h-96 overflow-hidden" : ""}`}>
          {records.map((record, index) => {
            const eventInfo = eventTypeMap[record.eventType] || { zh: record.eventType, en: record.eventType, icon: "📌" };
            const blockVerification = verification?.blockDetails[index];
            const isLast = index === records.length - 1;

            return (
              <div key={record.id} className="flex gap-3">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    blockVerification?.isVerified ? "bg-green-100" : "bg-red-100"
                  }`}>
                    {eventInfo.icon}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 ${blockVerification?.chainLinkValid ? "bg-green-200" : "bg-red-200"}`} style={{ minHeight: "40px" }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {locale === "zh" ? eventInfo.zh : eventInfo.en}
                    </span>
                    <span className="text-xs text-gray-400">
                      Block #{record.blockIndex}
                    </span>
                    {blockVerification && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        blockVerification.isVerified ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                      }`}>
                        {blockVerification.isVerified ? "✓" : "⚠"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-1">
                    {new Date(record.timestamp).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
                  </p>
                  {record.operatorName && (
                    <p className="text-xs text-gray-400">
                      {locale === "zh" ? "操作人" : "Operator"}: {record.operatorName}
                    </p>
                  )}
                  {record.eventData && Object.keys(record.eventData).length > 0 && (
                    <details className="mt-1">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                        {locale === "zh" ? "详情" : "Details"}
                      </summary>
                      <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(record.eventData, null, 2)}
                      </pre>
                    </details>
                  )}
                  <code className="text-xs text-gray-300 font-mono block mt-1">
                    {record.currentHash.slice(0, 24)}...
                  </code>
                </div>
              </div>
            );
          })}
        </div>

        {/* Expand button */}
        {records.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center text-sm text-blue-600 hover:underline mt-2"
          >
            {expanded
              ? locale === "zh" ? "收起" : "Show less"
              : locale === "zh" ? `展开全部 ${records.length} 条记录` : `Show all ${records.length} records`}
          </button>
        )}
      </div>
    </div>
  );
}
