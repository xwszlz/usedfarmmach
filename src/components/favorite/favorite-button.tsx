"use client";

import { translate } from "@/lib/i18n-runtime";
import { useState, useEffect } from "react";
import { Heart, Star } from "lucide-react";

export function FavoriteButton({
  productId,
  locale,
}: {
  productId: string;
  locale: string;
}) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`/api/favorites?productId=${productId}`, {
          credentials: "include",
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
    try {
      const res = isFavorited
        ? await fetch(`/api/favorites?productId=${productId}`, {
            method: "DELETE",
            credentials: "include",
          })
        : await fetch(`/api/favorites`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ productId }),
          });
      if (res.status === 401) {
        window.location.href = `/${locale}/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (res.ok) {
        setIsFavorited(!isFavorited);
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
      <span>{isFavorited ? (translate("已收藏", locale)) : translate("收藏", locale)}</span>
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
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`/api/follows?sellerId=${sellerId}`, {
          credentials: "include",
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
    try {
      const res = isFollowing
        ? await fetch(`/api/follows?sellerId=${sellerId}`, {
            method: "DELETE",
            credentials: "include",
          })
        : await fetch(`/api/follows`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ sellerId }),
          });
      if (res.status === 401) {
        window.location.href = `/${locale}/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (res.ok) {
        setIsFollowing(!isFollowing);
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
      <span>{isFollowing ? (translate("已关注", locale)) : translate("关注卖家", locale)}</span>
    </button>
  );
}
