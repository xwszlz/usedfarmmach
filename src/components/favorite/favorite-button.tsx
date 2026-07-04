"use client";

import { useState, useEffect } from "react";
import { Heart, Star } from "lucide-react";

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function FavoriteButton({
  productId,
  locale,
}: {
  productId: string;
  locale: string;
}) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const isZh = locale === "zh";

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    async function check() {
      try {
        const res = await fetch(`/api/favorites?productId=${productId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIsFavorited(data.isFavorited);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    check();
  }, [productId]);

  async function toggleFavorite() {
    const token = getToken();
    if (!token) {
      window.location.href = `/${locale}/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    try {
      if (isFavorited) {
        await fetch(`/api/favorites?productId=${productId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsFavorited(false);
      } else {
        await fetch(`/api/favorites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId }),
        });
        setIsFavorited(true);
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <button disabled className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-400">
        <Heart className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleFavorite}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
        isFavorited
          ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
      }`}
    >
      <Heart className={`h-4 w-4 ${isFavorited ? "fill-red-500" : ""}`} />
      <span>{isFavorited ? (isZh ? "已收藏" : "Saved") : isZh ? "收藏" : "Save"}</span>
    </button>
  );
}

export function FollowButton({
  sellerId,
  locale,
}: {
  sellerId: string;
  locale: string;
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const isZh = locale === "zh";

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    async function check() {
      try {
        const res = await fetch(`/api/follows?sellerId=${sellerId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIsFollowing(data.isFollowing);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    check();
  }, [sellerId]);

  async function toggleFollow() {
    const token = getToken();
    if (!token) {
      window.location.href = `/${locale}/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    try {
      if (isFollowing) {
        await fetch(`/api/follows?sellerId=${sellerId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsFollowing(false);
      } else {
        await fetch(`/api/follows`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sellerId }),
        });
        setIsFollowing(true);
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <button disabled className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-400">
        <Star className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleFollow}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
        isFollowing
          ? "border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100"
          : "border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
      }`}
    >
      <Star className={`h-4 w-4 ${isFollowing ? "fill-blue-500" : ""}`} />
      <span>{isFollowing ? (isZh ? "已关注" : "Following") : isZh ? "关注卖家" : "Follow"}</span>
    </button>
  );
}
