"use client";

import { translate } from "@/lib/i18n-runtime";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Calendar,
  MapPin,
  Clock,
  Play,
  ChevronRight,
  Users,
  Image as ImageIcon,
  Upload,
  Loader2,
} from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
import { useState, useEffect } from "react";
import { isCnSite } from "@/config/site";

interface FieldExpoPreviewProps {
  locale: string;
}

interface FieldVideo {
  id: string;
  brandName: string;
  machineType: string;
  url: string;
  uploadedAt: string;
}

const EXHIBITORS = [
  { name: "唐山鑫万达实业", product: "青贮饲料收获割台·智能压捆机", category: "青储机", boothId: "cms334utv0002135i2j3ynnk0" },
  { name: "郑州龙丰农业机械", product: "1LFT-455液压自动调幅犁·驱播机", category: "耕地机", boothId: "cms334v5f0007135imbya7sy7" },
  { name: "中机美诺科技", product: "9360C自走式饲料收获机", category: "青储机", boothId: "cms334vc6000c135ipuah7hmc" },
  { name: "西安亚澳农机", product: "旋播施肥一体机", category: "播种机", boothId: "cms334vix000h135iu2x9xp96" },
  { name: "河北利裕丰机械", product: "9QZ-2600B青饲料收获机", category: "青储机", boothId: "cms334vpp000m135ifyw65vrc" },
  { name: "宁晋县陆风制动", product: "深松联合整地机", category: "整地机械", boothId: "cms334vwh000r135i3zqwf1yy" },
  { name: "石家庄美迪机械", product: "9QS-6000S青饲料收获机", category: "青储机", boothId: "cms334w37000w135i64f96sq9" },
  { name: "山东当康农业装备", product: "驱动耙播种机", category: "播种机", boothId: "cms334w9v0011135it8v3pkeu" },
  { name: "晋州市冀丰农机", product: "雷沃4QZ-3QA2青饲料收获机", category: "青储机", boothId: "cms334wgj0016135ia4acdntq" },
  { name: "河北农哈哈机械", product: "播种机·智能耕整设备", category: "播种机", boothId: "cms334wn7001b135ihlh2hir9" },
];

export function FieldExpoPreview({ locale }: FieldExpoPreviewProps) {
  const t = useTranslations();
  const isZh = locale === "zh";
  const isCn = isCnSite();
  const tr = useTr();

  // Countdown calculation (target: 2026-07-29)
  const target = new Date("2026-07-29T09:00:00+08:00");
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

  // Field videos state
  const [allVideos, setAllVideos] = useState<FieldVideo[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch("/api/field-videos/list");
        if (res.ok) {
          const data = await res.json();
          setAllVideos(data.videos || []);
        }
      } catch (e) {
        console.error("Failed to fetch field videos", e);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
    const interval = setInterval(fetchVideos, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-green-700 via-green-600 to-green-500 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            {/* Left: Text */}
            <div>
              <p className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-medium">
                🔥 {isCn ? tr("第28届 · 真机下地 · 实效演示") : (translate("真实作业验证", locale))}
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {tr("河北农机新机具新技术推广演示会")}
              </h1>
              {!isCn && (
                <p className="mt-3 text-base text-green-100">
                  {translate("神雕展翼™ — 神雕农机展旗下的真实作业视频验证模块", locale)}
                </p>
              )}
              <div className="mt-6 space-y-3 text-lg text-green-100">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <span>2026年7月29日（周四）</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <span>{tr("石家庄·元氏县·神雕农机")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span>{tr("~20家国内头部农机品牌")}</span>
                </div>
              </div>

              {/* Countdown */}
              <div className="mt-8 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="text-lg font-semibold">
                    {isZh ? `倒计时 ${days}天 ${hours}小时` : `${days}d ${hours}h remaining`}
                  </span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/expo/field-videos`}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3 font-semibold text-amber-900 shadow-lg transition hover:bg-amber-300"
                >
                  <Upload className="h-5 w-5" />
                  {tr("上传作业视频")}
                </Link>
                <Link
                  href={`/${locale}/expo/china-brands`}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  {tr("浏览品牌库")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Right: GIF */}
            <div className="flex items-center justify-center">
              <div className="relative rounded-2xl bg-white/10 p-6 backdrop-blur-sm">
                <img
                  src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/expo/28th-field-expo-2026/preview.gif"
                  alt="第28届河北农机新机具新技术推广演示会"
                  className="h-auto w-full max-w-md rounded-lg shadow-2xl"
                />
                <p className="mt-3 text-center text-base font-medium text-white">
                  🔥 {tr("线下实地演示 · 5场作业")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <div>
              <div className="text-2xl font-bold text-green-600">~20</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{tr("参展品牌")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">5+</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{tr("品类覆盖")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">5场</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{tr("实地作业演示")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">全天</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{tr("线上直播")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Schedule removed */}

      {/* Field Videos - Live Demo */}
      <section className="border-b border-gray-200 bg-gray-50 py-12 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{tr("现场作业视频集锦")}</h2>
            <Link
              href={`/${locale}/expo/field-videos`}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 font-semibold text-amber-900 shadow transition hover:bg-amber-300"
            >
              <Upload className="h-4 w-4" />
              {tr("上传作业视频")}
            </Link>
          </div>
          <p className="mb-6 text-sm text-gray-500">{tr("扫码上传您的现场作业视频，即刻展示在大屏上")}</p>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : allVideos.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
              <Play className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="mt-4 text-sm text-gray-500">{tr("暂无现场视频，期待您的上传")}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(showAll ? allVideos : allVideos.slice(0, 12)).map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
              {!showAll && allVideos.length > 12 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-green-500"
                  >
                    显示全部 {allVideos.length} 个视频
                  </button>
                </div>
              )}
              {showAll && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500">
                    共 <span className="font-bold text-green-600">{allVideos.length}</span> 个视频 · 每30秒自动刷新
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Exhibitor List */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">
            {tr("参展企业 & 展品预告")}
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{tr("企业")}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{tr("核心展品")}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{tr("品类")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {EXHIBITORS.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {e.boothId ? (
                        <Link href={`/${locale}/expo/booth/${e.boothId}`} className="text-green-600 hover:underline dark:text-green-400">
                          {e.name}
                        </Link>
                      ) : (
                        <span>{e.name}</span>
                      )}
                      {e.boothId && (
                        <Link
                          href={`/${locale}/expo/china-brands`}
                          className="ml-2 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
                        >
                          {tr("品牌库已收录")}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.product}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                        {e.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {tr("以上为已公布参展企业（仅限来源·北方农业机械公众号），更多企业请以现场为准。")}
          </p>
        </div>
      </section>

      {/* Platform Assets */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
            {tr("神雕农机 · 平台实力")}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { num: "309", label: tr("品牌收录") },
              { num: "618", label: tr("配件入库") },
              { num: "14", label: tr("品类手册") },
              { num: "8", label: tr("语种覆盖") },
            ].map((stat, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-4 text-center dark:border-gray-800">
                <div className="text-3xl font-bold text-green-600">{stat.num}</div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-green-700 to-green-500 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold">
            {tr("品牌入库，全球可见")}
          </h2>
          <p className="mt-3 text-green-100">
            {tr("入驻神雕农机，参与永不落幕的农机世界展会")}
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href={`/${locale}/expo`}
              className="rounded-lg bg-white px-8 py-3 font-semibold text-green-700 shadow-lg transition hover:bg-green-50"
            >
              {tr("进入世界农机博览会")}
            </Link>
            <Link
              href={`/${locale}/expo/booth`}
              className="rounded-lg border border-white/30 bg-white/10 px-8 py-3 font-semibold backdrop-blur-sm transition hover:bg-white/20"
            >
              {tr("开通自助展台")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function VideoCard({ video }: { video: FieldVideo }) {
  const posterUrl = video.url + "?x-oss-process=video/snapshot,t_2000,f_jpg,w_600";
  const [playing, setPlaying] = useState(false);
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800">
      <div className="relative aspect-video bg-gray-200 dark:bg-gray-700">
        <img src={posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        {playing ? (
          <video
            src={video.url}
            className="absolute inset-0 h-full w-full object-cover z-10"
            controls
            autoPlay
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 z-20 flex items-center justify-center transition hover:bg-black/20"
          >
            <div className="rounded-full bg-white/20 p-4 backdrop-blur transition group-hover:bg-white/40">
              <Play className="h-8 w-8 text-white" />
            </div>
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{video.brandName}</p>
        <p className="text-xs text-gray-500">{video.machineType}</p>
      </div>
    </div>
  );
}
