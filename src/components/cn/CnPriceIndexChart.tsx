/**
 * CnPriceIndexChart — 价格指数图表（.cn 专属）
 *
 * 展示国产二手农机价格指数趋势。
 * 使用 recharts 库（已有依赖）绘制柱状图 + 折线图组合。
 */

"use client";

import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
} from "recharts";

// 模拟数据（实际应该从 API 获取）
const SAMPLE_DATA = [
  { month: "1月", index: 104.2, avgPrice: 78000, count: 42 },
  { month: "2月", index: 105.8, avgPrice: 79500, count: 38 },
  { month: "3月", index: 106.5, avgPrice: 81200, count: 45 },
  { month: "4月", index: 107.1, avgPrice: 82500, count: 52 },
  { month: "5月", index: 106.8, avgPrice: 81800, count: 48 },
  { month: "6月", index: 107.5, avgPrice: 83100, count: 55 },
  { month: "7月", index: 108.2, avgPrice: 84500, count: 50 },
  { month: "8月", index: 107.9, avgPrice: 83800, count: 47 },
  { month: "9月", index: 108.5, avgPrice: 85200, count: 53 },
  { month: "10月", index: 109.1, avgPrice: 86100, count: 49 },
  { month: "11月", index: 108.8, avgPrice: 85500, count: 44 },
  { month: "12月", index: 109.5, avgPrice: 86800, count: 51 },
];

interface CnPriceIndexChartProps {
  data?: typeof SAMPLE_DATA;
  height?: number;
}

export default function CnPriceIndexChart({
  data = SAMPLE_DATA,
  height = 300,
}: CnPriceIndexChartProps) {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#666" }}
            axisLine={{ stroke: "#e0e0e0" }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: "#666" }}
            axisLine={{ stroke: "#e0e0e0" }}
            label={{
              value: "价格指数",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: "#666" },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: "#666" }}
            axisLine={{ stroke: "#e0e0e0" }}
            label={{
              value: "均价 (¥)",
              angle: 90,
              position: "insideRight",
              style: { fontSize: 12, fill: "#666" },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => {
              if (name === "价格指数") return [value.toFixed(1), name];
              if (name === "均价") return [`¥${value.toLocaleString()}`, name];
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          />
          {/* 柱状图：均价 */}
          <Bar
            yAxisId="right"
            dataKey="avgPrice"
            name="均价"
            fill="#e8f4fd"
            stroke="#93c5fd"
            strokeWidth={1}
            barSize={20}
            radius={[2, 2, 0, 0]}
          />
          {/* 折线图：价格指数 */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="index"
            name="价格指数"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3, fill: "#2563eb" }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 图表说明 */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span>数据来源：神雕农机平台交易数据</span>
        <span>样本量：{data.reduce((sum, d) => sum + d.count, 0)} 台</span>
      </div>
    </div>
  );
}
