// src/components/DistributionBarChart.tsx: 全体ユーザー回答分布横棒グラフ（正解・回答・平均値のカラー & 重なりシマシマ・目盛りグリッド線）

import React from 'react';
import type { DistributionBin } from '../types/quiz';

interface DistributionBarChartProps {
  distribution: DistributionBin[];
}

// 目盛り（縦グリッド線）の本数。0% から最大値までを4等分する
const GRID_DIVISIONS = 4;

/**
 * 目盛りの最大値（%）。最大ビンの割合を20%刻みで切り上げる（20〜100%）
 */
function getScaleMax(maxPercent: number): number {
  return Math.min(100, Math.max(20, Math.ceil(maxPercent / 20) * 20));
}

/**
 * 棒の属性（回答・正解・平均値）に応じて色クラス名を判定（面1・面2 共通）
 * 重なった場合はグラデーションではなくシマシマ（斜めストライプ）にする
 */
export function getBarColorClass(
  bin: Pick<DistributionBin, 'hasUserAnswer' | 'hasActualPrice' | 'hasAverageExpected'>
): string {
  const u = Boolean(bin.hasUserAnswer);
  const a = Boolean(bin.hasActualPrice);
  const avg = Boolean(bin.hasAverageExpected);

  if (u && a && avg) return 'stripe-all';
  if (u && a) return 'stripe-user-actual';
  if (u && avg) return 'stripe-user-avg';
  if (a && avg) return 'stripe-actual-avg';
  if (u) return 'bar-user';
  if (a) return 'bar-actual';
  if (avg) return 'bar-avg';
  return 'bar-default';
}

export const DistributionBarChart: React.FC<DistributionBarChartProps> = ({ distribution }) => {
  const scaleMax = getScaleMax(Math.max(...distribution.map((d) => d.percent)));
  const ticks = Array.from({ length: GRID_DIVISIONS + 1 }, (_, i) => (scaleMax / GRID_DIVISIONS) * i);

  return (
    <div className="dist-chart-container" id="dist-chart-container">
      {/* グラフ上部ヘッダー（タイトル ＋ カラー凡例） */}
      <div className="dist-chart-top-bar">
        <span className="dist-chart-title">全体の回答分布</span>
        <div className="dist-chart-legend" id="dist-chart-legend">
          <span className="dist-legend-item">
            <span className="legend-swatch bar-user" /> 回答
          </span>
          <span className="dist-legend-item">
            <span className="legend-swatch bar-actual" /> 正解
          </span>
          <span className="dist-legend-item">
            <span className="legend-swatch bar-avg" /> 平均値
          </span>
          <span className="dist-legend-item">
            <span className="legend-swatch stripe-legend" /> 重なり
          </span>
        </div>
      </div>

      {/* 10分割・数字の横にダイレクトに伸びる横棒リスト（背後に目盛りの縦グリッド線） */}
      <div className="dist-plot-area">
        <div className="dist-grid-lines" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className="dist-grid-line" style={{ left: `${(tick / scaleMax) * 100}%` }} />
          ))}
        </div>

        <div className="dist-bars-list-direct">
          {distribution.map((bin, index) => {
            const widthPercent = (bin.percent / scaleMax) * 100;
            const colorClass = getBarColorClass(bin);

            return (
              <div key={index} className="dist-bar-item-inline">
                {/* 金額ラベル（数字） */}
                <div className="dist-price-label">{bin.label}</div>

                {/* 数字の真横から直接伸びる横棒 & 棒の先端に割合パーセント */}
                <div className="dist-bar-track">
                  {bin.percent > 0 && (
                    <div className={`dist-bar-direct ${colorClass}`} style={{ width: `${widthPercent}%` }} />
                  )}
                  <span className="dist-bin-percent" style={{ left: `${widthPercent}%` }}>
                    {bin.percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 目盛りラベル */}
      <div className="dist-axis-labels" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} className="dist-axis-label" style={{ left: `${(tick / scaleMax) * 100}%` }}>
            {tick}%
          </span>
        ))}
      </div>
    </div>
  );
};
