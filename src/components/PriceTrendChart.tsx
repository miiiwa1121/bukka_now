// src/components/PriceTrendChart.tsx: 物価推移の折れ線グラフ（面3）
// 面1・面2 と同じパネル・目盛りグリッド線で描画する。各地点を押すとその時点の価格を吹き出しで表示

import React, { useState } from 'react';
import type { QuestionResultItem } from '../types/quiz';
import { PriceNoteColumn } from './PriceNoteColumn';

interface PriceTrendChartProps {
  item: QuestionResultItem;
  questionIndex: number;
}

// 目盛り（横グリッド線）の本数。最小値から最大値までを4等分する
const GRID_DIVISIONS = 4;

/**
 * 1・2・5 × 10^k の「キリの良い」目盛り幅のうち、value 以上で最小のもの
 */
function niceStep(value: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  for (const factor of [1, 2, 5, 10]) {
    if (factor * magnitude >= value) return factor * magnitude;
  }
  return 10 * magnitude;
}

/**
 * 推移価格の最小〜最大がすべて収まる目盛り（下限・幅）を求める
 */
function getScale(prices: number[]): { min: number; step: number } {
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);

  // 推移がない（全て同額）場合は、価格の5%程度の目盛り幅で、価格がグラフの中ほどに来るようにする
  if (hi === lo) {
    const step = niceStep(Math.max(hi * 0.05, 1));
    return { min: Math.max(0, Math.floor(lo / step) * step - step * 2), step };
  }

  // 推移幅を3目盛り程度に収め（上下に余白を残す）、最小値〜最大値が全て入るまで目盛り幅を広げる
  let step = niceStep(Math.max((hi - lo) / (GRID_DIVISIONS - 1), 1));
  let min = Math.floor(lo / step) * step;
  while (min + step * GRID_DIVISIONS < hi) {
    step = niceStep(step * 1.01);
    min = Math.floor(lo / step) * step;
  }
  return { min, step };
}

export const PriceTrendChart: React.FC<PriceTrendChartProps> = ({ item, questionIndex }) => {
  const pastPrice = item.pastPrice;
  const pastYear = item.pastPriceYear;
  const currentPrice = item.actualPrice;

  // 価格変動
  const priceDiff = currentPrice - pastPrice;
  const changeRate = pastPrice > 0 ? ((priceDiff / pastPrice) * 100).toFixed(1) : '0';
  const isIncreased = priceDiff >= 0;

  // 折れ線グラフ用データ（過去基準年 ➔ 2022年 ➔ 2024年 ➔ 2026年）。中間年は補間値
  const points = [
    { year: pastYear, price: pastPrice },
    { year: '2022年', price: Math.round(pastPrice + (currentPrice - pastPrice) * 0.28) },
    { year: '2024年', price: Math.round(pastPrice + (currentPrice - pastPrice) * 0.72) },
    { year: '2026年', price: currentPrice },
  ];
  const currentIndex = points.length - 1;

  // 吹き出しを出している地点（初期表示は現在）
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);

  const scale = getScale(points.map((p) => p.price));
  const ticks = Array.from({ length: GRID_DIVISIONS + 1 }, (_, i) => scale.min + scale.step * i);
  const toYPercent = (price: number) => ((price - scale.min) / (scale.step * GRID_DIVISIONS)) * 100;
  // X 座標は面2の縦棒と同じく、等幅の列の中央（X軸ラベルの中央と一致）
  const toXPercent = (index: number) => ((index + 0.5) / points.length) * 100;

  const linePoints = points.map((p, i) => `${toXPercent(i)},${100 - toYPercent(p.price)}`).join(' ');
  const areaPoints = `${toXPercent(0)},100 ${linePoints} ${toXPercent(currentIndex)},100`;

  const pointLabel = (index: number) =>
    `${index === currentIndex ? '現在' : points[index].year} ${points[index].price.toLocaleString()}${item.unit}`;

  const selected = points[selectedIndex];
  const selectedY = toYPercent(selected.price);

  return (
    <div className="unpis-question-card" id={`trend-chart-${item.questionId}`}>
      {/* 統一ヘッダー */}
      <div className="unified-card-header">
        <div className="unified-header-left">
          <span className="unified-q-badge">Q{questionIndex + 1}</span>
          <span className="unified-cat-badge">{item.categoryLabel}</span>
          <h3 className="unified-q-title">{item.title}</h3>
        </div>
        <div className="unified-header-right">
          <span className="unified-meta-pill">
            変動率: <strong>{isIncreased ? `+${changeRate}%` : `${changeRate}%`}</strong>
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
          <span className="unified-stat-val">{currentPrice.toLocaleString()}{item.unit}</span>
        </div>

        <div className="unified-stat-cell avg">
          <span className="unified-stat-label">全体平均</span>
          <span className="unified-stat-val">{item.averageExpected.toLocaleString()}{item.unit}</span>
        </div>

        <div className="unified-stat-cell past">
          <span className="unified-stat-label">{pastYear}の相場</span>
          <span className="unified-stat-val">{pastPrice.toLocaleString()}{item.unit}</span>
        </div>
      </div>

      {/* 統一グラフコンテナ（面1・面2と同じパネル。凡例はなし） */}
      <div className="unified-chart-container">
        <div className="dist-chart-container">
          <div className="dist-chart-top-bar">
            <span className="dist-chart-title">価格の推移</span>
          </div>

          <div className="vplot-scroll trend-plot">
            <div className="vplot-content">
              {/* Y軸の目盛りラベル（金額） */}
              <div className="vplot-y-axis" aria-hidden="true">
                <div className="vplot-inner">
                  {ticks.map((tick) => (
                    <span key={tick} className="vplot-y-label" style={{ bottom: `${toYPercent(tick)}%` }}>
                      {tick.toLocaleString()}{item.unit}
                    </span>
                  ))}
                </div>
              </div>

              {/* プロット本体（背後に横グリッド線） */}
              <div className="vplot-area">
                <div className="vplot-inner">
                  {ticks.map((tick) => (
                    <span key={tick} className="vplot-grid-line" style={{ bottom: `${toYPercent(tick)}%` }} />
                  ))}

                  {/* 折れ線と塗り（0〜100 の座標系を領域いっぱいに伸ばす。線幅は拡大縮小しない） */}
                  <svg className="trend-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon className="trend-area" points={areaPoints} />
                    <polyline className="trend-line" points={linePoints} />
                  </svg>

                  {/* 押せる地点 */}
                  {points.map((p, i) => (
                    <button
                      key={p.year}
                      type="button"
                      className={`trend-point ${i === selectedIndex ? 'is-selected' : ''} ${i === currentIndex ? 'is-current' : ''}`}
                      style={{ left: `${toXPercent(i)}%`, bottom: `${toYPercent(p.price)}%` }}
                      onClick={() => setSelectedIndex(i)}
                      aria-label={pointLabel(i)}
                      aria-pressed={i === selectedIndex}
                    />
                  ))}

                  {/* 選択中の地点の価格吹き出し（上部に余裕がない地点では下側に出す） */}
                  <span
                    key={selectedIndex}
                    className={`trend-tooltip ${selectedY > 70 ? 'is-below' : ''} ${selectedIndex === 0 ? 'align-start' : ''} ${selectedIndex === currentIndex ? 'align-end' : ''}`}
                    style={{ left: `${toXPercent(selectedIndex)}%`, bottom: `${selectedY}%` }}
                  >
                    {pointLabel(selectedIndex)}
                  </span>
                </div>
              </div>

              {/* X軸の年ラベル */}
              <div className="vplot-x-labels">
                {/* 狭い画面では「年」を省いて数字だけにする（吹き出しには「年」付きで出る） */}
                {points.map((p) => (
                  <span key={p.year} className="vplot-x-label">
                    {p.year.replace('年', '')}
                    <span className="x-label-suffix">年</span>
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
