// src/components/DetailedPlotChart.tsx: 1円単位でプロットした回答分布の縦棒グラフ（面2）
// 面1（DistributionBarChart）と同じパネル・凡例・配色・目盛りグリッド線で描画する

import React, { useMemo } from 'react';
import type { QuestionResultItem } from '../types/quiz';
import { getBarColorClass } from './DistributionBarChart';
import { PriceNoteColumn } from './PriceNoteColumn';

interface DetailedPlotChartProps {
  item: QuestionResultItem;
  questionIndex: number;
}

interface PlotBarData {
  price: number;
  count: number;
  hasUserAnswer: boolean;
  hasActualPrice: boolean;
  hasAverageExpected: boolean;
}

// 目盛り（横グリッド線）の本数。0人 から最大値までを4等分する
const GRID_DIVISIONS = 4;

/**
 * 目盛りの最大値（人）。目盛りが整数になるよう4の倍数に切り上げる（最小4）
 */
function getScaleMax(maxCount: number): number {
  return Math.max(GRID_DIVISIONS, Math.ceil(maxCount / GRID_DIVISIONS) * GRID_DIVISIONS);
}

export const DetailedPlotChart: React.FC<DetailedPlotChartProps> = ({ item, questionIndex }) => {
  const averagePrice = Math.round(item.averageExpected);

  // 1円単位プロット用のデータを集計
  const { plotData, median } = useMemo(() => {
    const rawList = item.rawAnswers.length > 0 ? item.rawAnswers : [item.userAnswer];

    // 金額ごとの回答人数をカウント
    const freqMap = new Map<number, number>();
    for (const val of rawList) {
      freqMap.set(val, (freqMap.get(val) || 0) + 1);
    }

    // 回答があった金額に加え、正解・あなた・平均の金額は必ず軸に含める
    const prices = new Set<number>([item.userAnswer, item.actualPrice, averagePrice, ...freqMap.keys()]);

    const bars: PlotBarData[] = Array.from(prices)
      .sort((a, b) => a - b)
      .map((price) => ({
        price,
        count: freqMap.get(price) || 0,
        hasUserAnswer: price === item.userAnswer,
        hasActualPrice: price === item.actualPrice,
        hasAverageExpected: price === averagePrice,
      }));

    const sortedRaw = [...rawList].sort((a, b) => a - b);

    return {
      plotData: bars,
      median: sortedRaw[Math.floor(sortedRaw.length / 2)] ?? item.userAnswer,
    };
  }, [item, averagePrice]);

  const scaleMax = getScaleMax(Math.max(...plotData.map((b) => b.count)));
  const ticks = Array.from({ length: GRID_DIVISIONS + 1 }, (_, i) => (scaleMax / GRID_DIVISIONS) * i);

  return (
    <div className="unpis-question-card" id={`detailed-plot-${item.questionId}`}>
      {/* 統一ヘッダー */}
      <div className="unified-card-header">
        <div className="unified-header-left">
          <span className="unified-q-badge">Q{questionIndex + 1}</span>
          <span className="unified-cat-badge">{item.categoryLabel}</span>
          <h3 className="unified-q-title">{item.title}</h3>
        </div>
        <div className="unified-header-right">
          <span className="unified-meta-pill">
            回答者数: <strong>{item.totalResponses.toLocaleString()}</strong>人
          </span>
        </div>
      </div>

      {/* 統一メトリクスグリッド（4カラム） */}
      <div className="unified-metrics-grid">
        <div className="unified-stat-cell you">
          <span className="unified-stat-label">あなたの回答</span>
          <span className="unified-stat-val">{item.userAnswer.toLocaleString()}{item.unit}</span>
        </div>

        <div className="unified-stat-cell actual">
          <span className="unified-stat-label">正解（公的相場）</span>
          <span className="unified-stat-val">{item.actualPrice.toLocaleString()}{item.unit}</span>
        </div>

        <div className="unified-stat-cell avg">
          <span className="unified-stat-label">全体平均</span>
          <span className="unified-stat-val">{item.averageExpected.toLocaleString()}{item.unit}</span>
        </div>

        <div className="unified-stat-cell past">
          <span className="unified-stat-label">中央値</span>
          <span className="unified-stat-val">{median.toLocaleString()}{item.unit}</span>
        </div>
      </div>

      {/* 統一グラフコンテナ（面1と同じパネル・凡例） */}
      <div className="unified-chart-container">
        <div className="dist-chart-container">
          <div className="dist-chart-top-bar">
            <span className="dist-chart-title">1円単位の回答分布</span>
            <div className="dist-chart-legend">
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

          {/* 縦棒グラフ（金額の種類が多い場合は横スクロール。Y軸の目盛りは左に固定） */}
          <div className="vplot-scroll">
            <div className="vplot-content" style={{ minWidth: `calc(var(--vplot-axis-w) + ${plotData.length} * var(--vplot-col-min-w))` }}>
              {/* Y軸の目盛りラベル（人数） */}
              <div className="vplot-y-axis" aria-hidden="true">
                <div className="vplot-inner">
                  {ticks.map((tick) => (
                    <span key={tick} className="vplot-y-label" style={{ bottom: `${(tick / scaleMax) * 100}%` }}>
                      {tick}人
                    </span>
                  ))}
                </div>
              </div>

              {/* プロット本体（背後に横グリッド線） */}
              <div className="vplot-area">
                <div className="vplot-inner">
                  {ticks.map((tick) => (
                    <span key={tick} className="vplot-grid-line" style={{ bottom: `${(tick / scaleMax) * 100}%` }} />
                  ))}

                  <div className="vplot-columns">
                    {plotData.map((bar) => {
                      const heightPercent = (bar.count / scaleMax) * 100;
                      return (
                        <div
                          key={bar.price}
                          className="vplot-column"
                          title={`${bar.price.toLocaleString()}${item.unit}: ${bar.count}人`}
                        >
                          <div
                            className={`vplot-bar ${getBarColorClass(bar)}${bar.count === 0 ? ' is-zero' : ''}`}
                            style={{ height: bar.count > 0 ? `${heightPercent}%` : undefined }}
                          />
                          {/* 0人のマーカー（高さ5px）の場合はその上に出す */}
                          <span className="vplot-count" style={{ bottom: bar.count > 0 ? `${heightPercent}%` : '5px' }}>
                            {bar.count}人
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* X軸の金額ラベル */}
              <div className="vplot-x-labels">
                {plotData.map((bar) => (
                  <span key={bar.price} className="vplot-x-label">
                    {bar.price.toLocaleString()}{item.unit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* コラム（3面共通） */}
      <PriceNoteColumn note={item.priceNote} />
    </div>
  );
};
