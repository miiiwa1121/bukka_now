// src/components/DistributionBarChart.tsx: 全体ユーザー回答分布横棒グラフ（正解・回答・平均値のカラー & 重なりシマシマ・バッジ非表示）

import React from 'react';
import type { DistributionBin } from '../types/quiz';

interface DistributionBarChartProps {
  distribution: DistributionBin[];
  userAnswer: number;
  actualPrice: number;
  minAnswer: number;
  maxAnswer: number;
  unit?: string;
}

/**
 * ビンの属性（回答・正解・平均値）に応じてクラス名を判定
 * 重なった場合はグラデーションではなくシマシマ（斜めストライプ）にする
 */
function getBarColorClass(bin: DistributionBin): string {
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

export const DistributionBarChart: React.FC<DistributionBarChartProps> = ({
  distribution,
  minAnswer,
  maxAnswer,
  unit = '円',
}) => {
  const maxPercent = Math.max(...distribution.map((d) => d.percent), 5);

  return (
    <div className="dist-chart-container" id="dist-chart-container">
      {/* グラフ上部ヘッダー（最低・最高値） */}
      <div className="dist-chart-top-bar">
        <span className="dist-chart-title">全体の回答分布</span>
        <div className="dist-min-max-inline">
          <span>最低: <strong>{minAnswer.toLocaleString()}{unit}</strong></span>
          <span className="dist-stat-divider">/</span>
          <span>最高: <strong>{maxAnswer.toLocaleString()}{unit}</strong></span>
        </div>
      </div>

      {/* カラー凡例（レジェンド: 正解・回答・平均値・シマシマ重なり） */}
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

      {/* 10分割・数字の横にダイレクトに伸びる横棒リスト */}
      <div className="dist-bars-list-direct">
        {distribution.map((bin, index) => {
          // テキストバッジを非表示にしたため、最大78%のスケールで横棒をダイナミックに伸長
          const widthPercent = bin.percent > 0
            ? Math.max(3, Math.round((bin.percent / maxPercent) * 78))
            : 0;
          const colorClass = getBarColorClass(bin);

          return (
            <div key={index} className="dist-bar-item-inline">
              {/* 金額ラベル（数字） */}
              <div className="dist-price-label">
                {bin.label}
              </div>

              {/* 数字の真横から直接伸びる横棒 & 割合パーセントのみ */}
              <div className="dist-bar-growth-area">
                {widthPercent > 0 ? (
                  <div
                    className={`dist-bar-direct ${colorClass}`}
                    style={{ width: `${widthPercent}%` }}
                  />
                ) : (
                  <div className={`dist-bar-direct is-zero ${colorClass}`} />
                )}

                <div className="dist-inline-meta">
                  <span className="dist-bin-percent">{bin.percent}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
