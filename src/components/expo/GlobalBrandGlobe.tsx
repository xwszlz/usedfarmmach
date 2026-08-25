"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";

/**
 * 国际品牌农机全球分布图（3D 地球）
 * 数据源：/geo/agri-brands.json（品牌总部坐标）+ /geo/countries-110m.json（世界地图）
 */

interface AgriBrand {
  en: string;
  name: string;
  city: string;
  ll: [number, number];
  r: RegionKey;
  note: string;
}

type RegionKey = "na" | "eu" | "ea" | "sa_asia" | "sa";

const REGION_COLORS: Record<RegionKey, string> = {
  na: "#f5a524", // 北美
  eu: "#4cc38a", // 欧洲
  ea: "#e05252", // 东亚
  sa_asia: "#58a6ff", // 南亚
  sa: "#bc8cff", // 南美
};

const REGION_LABELS: Record<string, { zh: string; en: string; ru: string }> = {
  na: { zh: "北美", en: "North America", ru: "Сев. Америка" },
  eu: { zh: "欧洲", en: "Europe", ru: "Европа" },
  ea: { zh: "东亚", en: "East Asia", ru: "Вост. Азия" },
  sa_asia: { zh: "南亚", en: "South Asia", ru: "Юж. Азия" },
  sa: { zh: "南美", en: "South America", ru: "Юж. Америка" },
};

export default function GlobalBrandGlobe({ locale }: { locale: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<AgriBrand | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const svgSel = d3.select(svgRef.current);
    const W = () => containerRef.current?.clientWidth || 800;
    const H = () => containerRef.current?.clientHeight || 560;

    const projection = d3
      .geoOrthographic()
      .scale(Math.min(W(), H()) * 0.42)
      .translate([W() / 2, H() / 2])
      .clipAngle(90);
    const path = d3.geoPath(projection);

    let rotation: [number, number, number] = [-30, -18, 0];
    let dragging = false;
    let lastInteract = Date.now();
    let raf = 0;

    const g = svgSel.append("g");
    const sphere = g.append("path").attr("fill", "#0e1930").attr("stroke", "#2a3d5f");
    const grat = g.append("path").attr("fill", "none").attr("stroke", "#1d2c47");
    const land = g
      .append("path")
      .attr("fill", "#233a5e")
      .attr("stroke", "#3b5a8a")
      .attr("stroke-width", 0.5);
    const borders = g
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#31507c")
      .attr("stroke-width", 0.4)
      .attr("opacity", 0.6);
    const markerG = g.append("g");

    const draw = (brands: AgriBrand[], world: any) => {
      projection.rotate(rotation);
      sphere.attr("d", path({ type: "Sphere" }) || "");
      grat.attr("d", path(d3.geoGraticule10()) || "");
      if (world) {
        const landFc = topojson.feature(world, world.objects.countries) as any;
        land.attr("d", path(landFc) || "");
        borders.attr(
          "d",
          path(topojson.mesh(world, world.objects.countries, (a, b) => a !== b)) || ""
        );
      }
      const r = projection.scale() * 0.008 + 3;
      markerG
        .selectAll("circle")
        .data(brands, (d) => (d as AgriBrand).en)
        .join("circle")
        .attr("r", r)
        .attr("cx", (d) => (projection((d as AgriBrand).ll)?.[0] ?? 0))
        .attr("cy", (d) => (projection((d as AgriBrand).ll)?.[1] ?? 0))
        .attr("fill", (d) => REGION_COLORS[(d as AgriBrand).r])
        .attr("stroke", "#0b1220")
        .attr("stroke-width", 1)
        .attr("opacity", (d) =>
          d3.geoDistance((d as AgriBrand).ll, [-rotation[0], -rotation[1]]) < Math.PI / 2 ? 0.95 : 0
        )
        .style("pointer-events", (d) =>
          d3.geoDistance((d as AgriBrand).ll, [-rotation[0], -rotation[1]]) < Math.PI / 2 ? "auto" : "none"
        )
        .on("mouseenter", (_ev, d) => setHovered(d as AgriBrand))
        .on("mouseleave", () => setHovered(null));
    };

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.7, 6])
      .on("zoom", (ev) => g.attr("transform", ev.transform));

    svgSel.call(zoomBehavior as any).on("dblclick.zoom", null);
    svgSel.on("dblclick", () => {
      zoomBehavior.transform(svgSel.transition().duration(400) as any, d3.zoomIdentity);
    });

    const drag = d3
      .drag<SVGSVGElement, unknown>()
      .on("start", () => {
        dragging = true;
        svgSel.classed("cursor-grabbing", true);
      })
      .on("drag", (ev) => {
        const k = d3.zoomTransform(svgSel.node()!).k;
        const dx = (ev.dx * 0.28) / k;
        const dy = (ev.dy * 0.28) / k;
        rotation[0] += dx;
        rotation[1] = Math.max(-89, Math.min(89, rotation[1] - dy));
        lastInteract = Date.now();
      })
      .on("end", () => {
        dragging = false;
        svgSel.classed("cursor-grabbing", false);
      });
    svgSel.call(drag as any);

    const tick = () => {
      if (!dragging && Date.now() - lastInteract > 2500) {
        rotation[0] += 0.12;
      }
      draw(brandsRef.current, worldRef.current);
      raf = requestAnimationFrame(tick);
    };

    let brands: AgriBrand[] = [];
    let worldData: any = null;

    // refs so tick closure sees latest
    const brandsRef = { current: brands };
    const worldRef = { current: worldData };

    Promise.all([
      fetch("/geo/agri-brands.json").then((r) => r.json()),
      fetch("/geo/countries-110m.json").then((r) => r.json()),
    ])
      .then(([b, w]) => {
        if (cancelled) return;
        brandsRef.current = b;
        worldRef.current = w;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    const onResize = () => {
      projection.scale(Math.min(W(), H()) * 0.42).translate([W() / 2, H() / 2]);
    };
    const ro = new ResizeObserver(onResize);
    if (containerRef.current) ro.observe(containerRef.current);

    raf = requestAnimationFrame(tick);

    cleanup = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      svgSel.selectAll("*").remove();
      svgSel.on(".zoom", null).on(".drag", null).on("dblclick", null);
    };
    return cleanup;
  }, []);

  const regionLabel = (k: RegionKey) => {
    const l = REGION_LABELS[k];
    if (!l) return k;
    if (locale === "zh") return l.zh;
    if (locale === "ru") return l.ru;
    return l.en;
  };

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative h-[560px] w-full overflow-hidden rounded-xl border border-slate-700/50"
        style={{
          background:
            "radial-gradient(1200px 700px at 70% -10%, #16233c 0%, transparent 60%), #0b1220",
        }}
      >
        <svg ref={svgRef} className="h-full w-full cursor-grab" />
        {hovered && (
          <div
            className="pointer-events-none absolute right-4 top-4 max-w-[240px] rounded-lg border border-slate-600/60 bg-slate-900/95 p-3 text-xs leading-relaxed text-slate-100 shadow-xl"
            style={{ zIndex: 10 }}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: REGION_COLORS[hovered.r] }}
              />
              <b className="text-sm">{locale === "zh" ? hovered.name : hovered.en}</b>
            </div>
            <div className="mt-1 text-slate-400">{hovered.en}</div>
            <div className="mt-1">📍 {hovered.city}</div>
            <div className="mt-1 text-slate-300">{hovered.note}</div>
            <div className="mt-1 text-[10px] text-slate-500">{regionLabel(hovered.r)}</div>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            {locale === "zh"
              ? "地图数据加载失败"
              : locale === "ru"
              ? "Ошибка загрузки карты"
              : "Failed to load map data"}
          </div>
        )}
        <div className="absolute bottom-3 left-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {Object.entries(REGION_COLORS).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
              {regionLabel(k as RegionKey)}
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute bottom-3 right-4 text-[10px] text-slate-600">
          {locale === "zh"
            ? "拖动旋转 · 滚轮缩放 · 双击复位"
            : locale === "ru"
            ? "Перетащите · Колесо · Двойной клик"
            : "Drag to rotate · Scroll to zoom · Double-click to reset"}
        </div>
      </div>
    </div>
  );
}
