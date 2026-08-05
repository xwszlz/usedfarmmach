"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";

interface Contract {
  id: string;
  contractNo: string;
  title: string;
  status: string;
  contractType: string;
  priceCny: number;
  priceUsd: number | null;
  currency: string;
  tradeTerm: string;
  sellerSignedAt: string | null;
  buyerSignedAt: string | null;
  createdAt: string;
  validFrom: string | null;
  validUntil: string | null;
  product: {
    id: string;
    modelName: string;
    year: number;
    brand: { nameZh: string; nameEn: string };
    images: { url: string }[];
  };
  seller: {
    id: string;
    companyName: string | null;
    username: string | null;
    phone: string | null;
  };
  buyer: {
    id: string;
    companyName: string | null;
    username: string | null;
    phone: string | null;
  };
}

const STATUS_MAP: Record<string, { zh: string; en: string; color: string }> = {
  draft: { zh: "草稿", en: "Draft", color: "bg-gray-100 text-gray-600" },
  pending_seller: { zh: "待卖方签署", en: "Pending Seller", color: "bg-yellow-100 text-yellow-700" },
  pending_buyer: { zh: "待买方签署", en: "Pending Buyer", color: "bg-orange-100 text-orange-700" },
  signed: { zh: "已签署", en: "Signed", color: "bg-green-100 text-green-700" },
  executed: { zh: "已履行", en: "Executed", color: "bg-blue-100 text-blue-700" },
  cancelled: { zh: "已取消", en: "Cancelled", color: "bg-red-100 text-red-700" },
  disputed: { zh: "争议中", en: "Disputed", color: "bg-red-100 text-red-700" },
};

export default function ContractsClient() {
  const t = useTranslations();
  const locale = useLocale();
  const isZh = locale === "zh";
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [role, setRole] = useState<"all" | "seller" | "buyer">("all");

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts?role=${role}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setContracts(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch contracts:", err);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isZh ? "我的合同" : "My Contracts"}
        </h1>
        <div className="flex gap-2">
          {(["all", "seller", "buyer"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                role === r
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r === "all" ? (isZh ? "全部" : "All") : r === "seller" ? (isZh ? "作为卖方" : "As Seller") : (isZh ? "作为买方" : "As Buyer")}
            </button>
          ))}
        </div>
      </div>

      {contracts.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <p className="text-gray-400 text-lg">
            {isZh ? "暂无合同记录" : "No contracts yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => {
            const statusInfo = STATUS_MAP[contract.status] || STATUS_MAP.draft;
            return (
              <div
                key={contract.id}
                onClick={() => setSelectedContract(contract)}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    {contract.product.images[0]?.url ? (
                      <img
                        src={contract.product.images[0].url}
                        alt={contract.product.modelName}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-300 text-xs">No img</span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {contract.product.brand.nameZh} {contract.product.modelName}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {contract.contractNo} | {contract.product.year}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        ¥{(contract.priceCny / 10000).toFixed(2)}{isZh ? "万" : "k"}
                        {contract.priceUsd && ` (~$${(contract.priceUsd).toFixed(0)})`}
                        <span className="ml-2 text-gray-400">{contract.tradeTerm}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
                      {isZh ? statusInfo.zh : statusInfo.en}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(contract.createdAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                    </p>
                  </div>
                </div>
                {/* Signature status */}
                <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-xs">
                  <span className={contract.sellerSignedAt ? "text-green-600" : "text-gray-400"}>
                    {isZh ? "卖方" : "Seller"}: {contract.sellerSignedAt ? `✓ ${new Date(contract.sellerSignedAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}` : (isZh ? "未签" : "Unsigned")}
                  </span>
                  <span className={contract.buyerSignedAt ? "text-green-600" : "text-gray-400"}>
                    {isZh ? "买方" : "Buyer"}: {contract.buyerSignedAt ? `✓ ${new Date(contract.buyerSignedAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}` : (isZh ? "未签" : "Unsigned")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contract Detail Modal */}
      {selectedContract && (
        <ContractDetailModal
          contract={selectedContract}
          isZh={isZh}
          onClose={() => setSelectedContract(null)}
          onUpdate={fetchContracts}
        />
      )}
    </div>
  );
}

function ContractDetailModal({
  contract,
  isZh,
  onClose,
  onUpdate,
}: {
  contract: Contract;
  isZh: boolean;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [signing, setSigning] = useState(false);
  const [detail, setDetail] = useState<typeof contract | null>(contract);
  const [terms, setTerms] = useState<string>("");

  useEffect(() => {
    // Fetch full detail with terms
    fetch(`/api/contracts/${contract.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setDetail(json.data);
          setTerms(json.data.terms || "");
        }
      })
      .catch(console.error);
  }, [contract.id]);

  const handleSign = async (role: "seller" | "buyer") => {
    setSigning(true);
    try {
      // Generate a text-based signature hash
      const timestamp = new Date().toISOString();
      const signature = `sig_${role}_${timestamp}`;

      const res = await fetch(`/api/contracts/${contract.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role, signature }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          alert(json.message);
          onUpdate();
          onClose();
        }
      } else {
        const err = await res.json();
        alert(err.error || "Sign failed");
      }
    } catch (err) {
      console.error("Sign error:", err);
      alert("Sign failed");
    } finally {
      setSigning(false);
    }
  };

  if (!detail) return null;

  const statusInfo = STATUS_MAP[detail.status] || STATUS_MAP.draft;
  const currentUserRole = detail.sellerSignedAt ? "buyer" : detail.buyerSignedAt ? "seller" : null;
  const canSign = detail.status === "draft" || detail.status === "pending_seller" || detail.status === "pending_buyer";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {isZh ? "合同详情" : "Contract Detail"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {/* Contract info */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{isZh ? "合同编号" : "Contract No"}</span>
            <span className="font-mono text-gray-900">{detail.contractNo}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{isZh ? "状态" : "Status"}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
              {isZh ? statusInfo.zh : statusInfo.en}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{isZh ? "设备" : "Equipment"}</span>
            <span className="text-gray-900">
              {detail.product.brand.nameZh} {detail.product.modelName} ({detail.product.year})
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{isZh ? "成交价" : "Price"}</span>
            <span className="text-gray-900 font-semibold">
              ¥{(detail.priceCny / 10000).toFixed(2)}{isZh ? "万" : "k"}
              {detail.priceUsd && ` (~$${detail.priceUsd.toFixed(0)})`}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{isZh ? "贸易条款" : "Trade Term"}</span>
            <span className="text-gray-900">{detail.tradeTerm}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{isZh ? "卖方" : "Seller"}</span>
            <span className="text-gray-900">
              {detail.seller.companyName || detail.seller.username || "—"}
              {detail.sellerSignedAt && (
                <span className="ml-2 text-green-600 text-xs">
                  ✓ {new Date(detail.sellerSignedAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{isZh ? "买方" : "Buyer"}</span>
            <span className="text-gray-900">
              {detail.buyer.companyName || detail.buyer.username || "—"}
              {detail.buyerSignedAt && (
                <span className="ml-2 text-green-600 text-xs">
                  ✓ {new Date(detail.buyerSignedAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Contract Terms */}
        {terms && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              {isZh ? "合同条款" : "Contract Terms"}
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap">
              {terms}
            </div>
          </div>
        )}

        {/* Sign buttons */}
        {canSign && (
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => handleSign("seller")}
              disabled={signing || !!detail.sellerSignedAt}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {detail.sellerSignedAt
                ? (isZh ? "卖方已签" : "Seller Signed ✓")
                : (isZh ? "卖方签署" : "Sign as Seller")}
            </button>
            <button
              onClick={() => handleSign("buyer")}
              disabled={signing || !!detail.buyerSignedAt}
              className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {detail.buyerSignedAt
                ? (isZh ? "买方已签" : "Buyer Signed ✓")
                : (isZh ? "买方签署" : "Sign as Buyer")}
            </button>
          </div>
        )}

        {detail.status === "signed" && (
          <div className="pt-4 border-t border-gray-100">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-green-600 font-medium">
                {isZh ? "合同已双方签署生效" : "Contract is fully signed and effective"}
              </p>
              {detail.validFrom && detail.validUntil && (
                <p className="text-sm text-gray-500 mt-1">
                  {isZh ? "有效期" : "Valid"}:{" "}
                  {new Date(detail.validFrom).toLocaleDateString(isZh ? "zh-CN" : "en-US")} —{" "}
                  {new Date(detail.validUntil).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
