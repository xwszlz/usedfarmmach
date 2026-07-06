"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Star, Search, Trash2, Bell } from "lucide-react";
import Link from "next/link";
import { getImageUrl } from "@/lib/image-url";
import { formatPrice } from "@/lib/utils";

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

interface FavoriteItem {
  id: string;
  product: {
    id: string;
    modelName: string;
    year: number;
    priceCny: number;
    condition: string;
    status: string;
    brand: { nameZh: string; nameEn: string };
    images: { url: string }[];
  };
}

interface FollowItem {
  id: string;
  seller: {
    id: string;
    companyName: string | null;
    country: string | null;
  };
}

interface SavedSearchItem {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  notifyOnNew: boolean;
  createdAt: string;
}

type Tab = "favorites" | "following" | "saved";

export function FavoritesClient({ locale }: { locale: string }) {
  const [tab, setTab] = useState<Tab>("favorites");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [follows, setFollows] = useState<FollowItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isZh = locale === "zh";

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    async function fetchAll() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [favRes, followRes, searchRes] = await Promise.all([
          fetch("/api/favorites", { headers }),
          fetch("/api/follows", { headers }),
          fetch("/api/saved-searches", { headers }),
        ]);

        if (favRes.ok) {
          const data = await favRes.json();
          setFavorites(data.favorites || []);
        }
        if (followRes.ok) {
          const data = await followRes.json();
          setFollows(data.follows || []);
        }
        if (searchRes.ok) {
          const data = await searchRes.json();
          setSavedSearches(data.savedSearches || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  async function removeFavorite(productId: string) {
    try {
      await fetch(`/api/favorites?productId=${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setFavorites(favorites.filter((f) => f.product.id !== productId));
    } catch {
      // ignore
    }
  }

  async function unfollow(sellerId: string) {
    try {
      await fetch(`/api/follows?sellerId=${sellerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setFollows(follows.filter((f) => f.seller.id !== sellerId));
    } catch {
      // ignore
    }
  }

  async function deleteSearch(id: string) {
    try {
      await fetch(`/api/saved-searches?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setSavedSearches(savedSearches.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-center text-gray-400">{isZh ? "加载中..." : "Loading..."}</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "favorites", label: isZh ? "收藏设备" : "Favorites", count: favorites.length },
    { key: "following", label: isZh ? "关注卖家" : "Following", count: follows.length },
    { key: "saved", label: isZh ? "保存搜索" : "Saved Searches", count: savedSearches.length },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {isZh ? "我的收藏" : "My Favorites"}
      </h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            <span className="ml-1 text-xs text-gray-400">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Favorites tab */}
      {tab === "favorites" && (
        <div className="space-y-3">
          {favorites.length === 0 ? (
            <EmptyState icon={Heart} text={isZh ? "暂无收藏设备" : "No favorites yet"} isZh={isZh} />
          ) : (
            favorites.map((fav) => (
              <Card key={fav.id}>
                <CardContent className="flex items-center gap-4 py-3">
                  <Link href={`/${locale}/products/${fav.product.id}`} className="flex flex-1 items-center gap-4">
                    <div className="h-16 w-20 overflow-hidden rounded-lg bg-gray-100">
                      {fav.product.images[0] ? (
                        <img src={getImageUrl(fav.product.images[0].url)} alt={fav.product.modelName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">No img</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {isZh ? fav.product.brand.nameZh : fav.product.brand.nameEn} {fav.product.modelName}
                      </p>
                      <p className="text-sm text-gray-500">{fav.product.year} · {fav.product.condition}</p>
                      <p className="text-sm font-semibold text-primary-600">{formatPrice(fav.product.priceCny, "cny")}</p>
                    </div>
                  </Link>
                  <button
                    onClick={() => removeFavorite(fav.product.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Following tab */}
      {tab === "following" && (
        <div className="space-y-3">
          {follows.length === 0 ? (
            <EmptyState icon={Star} text={isZh ? "暂无关注卖家" : "Not following anyone"} isZh={isZh} />
          ) : (
            follows.map((follow) => (
              <Card key={follow.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {follow.seller.companyName || (isZh ? "未命名卖家" : "Unnamed Seller")}
                    </p>
                    {follow.seller.country && (
                      <p className="text-sm text-gray-500">{follow.seller.country}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/${locale}/seller/${follow.seller.id}`}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-primary-300 hover:text-primary-600"
                    >
                      {isZh ? "查看主页" : "View Profile"}
                    </Link>
                    <button
                      onClick={() => unfollow(follow.seller.id)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Saved searches tab */}
      {tab === "saved" && (
        <div className="space-y-3">
          {savedSearches.length === 0 ? (
            <EmptyState icon={Search} text={isZh ? "暂无保存搜索" : "No saved searches"} isZh={isZh} />
          ) : (
            savedSearches.map((search) => (
              <Card key={search.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{search.name}</p>
                      {search.notifyOnNew && (
                        <Badge variant="secondary" className="text-xs">
                          <Bell className="mr-1 h-3 w-3" />
                          {isZh ? "通知" : "Notify"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {isZh ? "创建于" : "Created"} {new Date(search.createdAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/${locale}/products?saved=${search.id}`}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-primary-300 hover:text-primary-600"
                    >
                      {isZh ? "搜索" : "Search"}
                    </Link>
                    <button
                      onClick={() => deleteSearch(search.id)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text, isZh }: { icon: typeof Heart; text: string; isZh: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Icon className="mb-3 h-12 w-12 opacity-30" />
      <p className="text-sm">{text}</p>
      <Link
        href={isZh ? "/zh/products" : "/en/products"}
        className="mt-4 text-sm text-primary-600 hover:text-primary-700"
      >
        {isZh ? "去浏览农机 →" : "Browse equipment →"}
      </Link>
    </div>
  );
}
