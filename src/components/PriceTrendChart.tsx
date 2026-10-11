// src/components/PriceTrendChart.tsx: 物価推移の折れ線グラフ（面3）
// 面1・面2 と同じパネル・目盛りグリッド線で描画する。
// データは小売物価統計調査（東京都区部）の年平均価格。グラフ上を押す・なぞると、最も近い年の価格を吹き出しで表示する

import React, { useRef, useState } from 'react';
import type { QuestionResultItem } from '../types/quiz';
import { formatAmount } from '../utils/format';
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

/**
 * X軸ラベルを付ける年（10年ごと。期間が短い場合は間隔を詰める）
 */
function getYearTicks(firstYear: number, lastYear: number): { years: number[]; interval: number } {
  const span = lastYear - firstYear;
  if (span <= 0) return { years: [firstYear], interval: 1 };
  const interval = span >= 40 ? 10 : span >= 16 ? 5 : span >= 6 ? 2 : 1;
  const years: number[] = [];
  for (let y = Math.ceil(firstYear / interval) * interval; y <= lastYear; y += interval) {
    years.push(y);
  }
  return { years, interval };
}

/** 価格の表示（100円未満で小数があるときだけ小数1桁） */
function formatPrice(price: number): string {
  return price < 100 && !Number.isInteger(price) ? price.toFixed(1) : Math.round(price).toLocaleString();
}

export const PriceTrendChart: React.FC<PriceTrendChartProps> = ({ item, questionIndex }) => {
  const history = item.priceHistory;
  const lastIndex = history.length - 1;
  const first = history[0];
  const last = history[lastIndex];

  // 最古の年からの変化（2倍以上は「約N倍」、それ未満は増減率）
  const ratio = first.price > 0 ? last.price / first.price : 1;
  const changeLabel =
    ratio >= 2
      ? `約${ratio < 10 ? ratio.toFixed(1) : Math.round(ratio)}倍`
      : `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1)}%`;

  // 吹き出しを出している地点（初期表示は最新年）
  const [selectedIndex, setSelectedIndex] = useState(lastIndex);
  const areaRef = useRef<HTMLDivElement>(null);

  const scale = getScale(history.map((p) => p.price));
  const ticks = Array.from({ length: GRID_DIVISIONS + 1 }, (_, i) => scale.min + scale.step * i);
  const toYPercent = (price: number) => ((price - scale.min) / (scale.step * GRID_DIVISIONS)) * 100;
  // X 座標は年に比例（左端 = 最古の年、右端 = 最新年）。1点しかない場合は中央
  const yearSpan = last.year - first.year;
  const toXPercent = (year: number) => (yearSpan > 0 ? ((year - first.year) / yearSpan) * 100 : 50);

  const linePoints = history.map((p) => `${toXPercent(p.year)},${100 - toYPercent(p.price)}`).join(' ');
  const areaPoints = `${toXPercent(first.year)},100 ${linePoints} ${toXPercent(last.year)},100`;

  const pointLabel = (index: number) =>
    `${index === lastIndex ? '現在' : `${history[index].year}年`} ${formatPrice(history[index].price)}${item.unit}`;

  // 押した・なぞった位置に最も近い年を選ぶ
  const selectAtClientX = (clientX: number) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratioX = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const year = first.year + ratioX * yearSpan;
    let nearest = 0;
    history.forEach((p, i) => {
      if (Math.abs(p.year - year) < Math.abs(history[nearest].year - year)) nearest = i;
    });
    setSelectedIndex(nearest);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(lastIndex, i + 1));
    }
  };

  const yearTicks = getYearTicks(first.year, last.year);
  // 狭い画面で非表示にする年（10年刻みは20年ごと、1年刻みは最新年から1年おきだけ残す）
  const isMinorTick = (year: number) =>
    (yearTicks.interval === 10 && year % 20 !== 0) ||
    (yearTicks.interval === 5 && year % 10 !== 0) ||
    (yearTicks.interval === 2 && year % 4 !== 0) ||
    (yearTicks.interval === 1 && (last.year - year) % 2 === 1);
  const selected = history[selectedIndex];
  const selectedX = toXPercent(selected.year);
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
            {first.year}年比: <strong>{changeLabel}</strong>
          </span>
        </div>
      </div>

      {/* 統一メトリクスグリッド（4カラム） */}
      <div className="unified-metrics-grid">
        <div className="unified-stat-cell you">
          <span className="unified-stat-label">あなたの回答</span>
          <span className="unified-stat-val">{formatAmount(item.userAnswer, item.unit, '未回答')}</span>
        </div>

        <div className="unified-stat-cell actual">
          <span className="unified-stat-label">正解（公的相場）</span>
          <span className="unified-stat-val">{item.actualPrice.toLocaleString()}{item.unit}</span>
        </div>

        <div className="unified-stat-cell avg">
          <span className="unified-stat-label">全体平均</span>
          <span className="unified-stat-val">{formatAmount(item.averageExpected, item.unit)}</span>
        </div>

        <div className="unified-stat-cell past">
          <span className="unified-stat-label">{first.year}年の価格</span>
          <span className="unified-stat-val">{formatPrice(first.price)}{item.unit}</span>
        </div>
      </div>

      {/* 統一グラフコンテナ（面1・面2と同じパネル。凡例はなし） */}
      <div className="unified-chart-container">
        <div className="dist-chart-container">
          <div className="dist-chart-top-bar">
            <span className="dist-chart-title">価格の推移</span>
            <span className="trend-period-label">{first.year}〜{last.year}年</span>
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

              {/* プロット本体（背後に横グリッド線）。押す・なぞる・←→キーで年を選ぶ */}
              <div className="vplot-area">
                <div
                  ref={areaRef}
                  className="vplot-inner trend-hit-area"
                  role="slider"
                  tabIndex={0}
                  aria-label={`${item.title}の価格推移`}
                  aria-valuemin={first.year}
                  aria-valuemax={last.year}
                  aria-valuenow={selected.year}
                  aria-valuetext={pointLabel(selectedIndex)}
                  onPointerDown={(e) => selectAtClientX(e.clientX)}
                  onPointerMove={(e) => {
                    // マウスはホバーで、タッチ・ペンは押している間だけ追従
                    if (e.pointerType === 'mouse' || e.buttons > 0) selectAtClientX(e.clientX);
                  }}
                  onKeyDown={handleKeyDown}
                  // グラフをなぞる操作をボード切り替えのスワイプ・ドラッグとして扱わせない
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                >
                  {ticks.map((tick) => (
                    <span key={tick} className="vplot-grid-line" style={{ bottom: `${toYPercent(tick)}%` }} />
                  ))}

                  {/* 折れ線と塗り（0〜100 の座標系を領域いっぱいに伸ばす。線幅は拡大縮小しない） */}
                  <svg className="trend-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon className="trend-area" points={areaPoints} />
                    <polyline className="trend-line" points={linePoints} />
                  </svg>

                  {/* 選択中の年の縦線と点 */}
                  <span className="chart-cursor-line" style={{ left: `${selectedX}%` }} aria-hidden="true" />
                  <span
                    className="trend-point is-selected"
                    style={{ left: `${selectedX}%`, bottom: `${selectedY}%` }}
                    aria-hidden="true"
                  />

                  {/* 選択中の年の価格吹き出し（上部に余裕がない場合は下側、左右端では内側に寄せる） */}
                  <span
                    className={`chart-tooltip ${selectedY > 70 ? 'is-below' : ''} ${selectedX < 15 ? 'align-start' : ''} ${selectedX > 85 ? 'align-end' : ''}`}
                    style={{ left: `${selectedX}%`, bottom: `${selectedY}%` }}
                  >
                    {pointLabel(selectedIndex)}
                  </span>
                </div>
              </div>

              {/* X軸の年ラベル（年に比例した位置） */}
              <div className="vplot-x-labels trend-x-labels" aria-hidden="true">
                {/* 狭い画面では is-minor の年を非表示にしてラベルの重なりを防ぐ */}
                {yearTicks.years.map((year) => (
                  <span
                    key={year}
                    className={`trend-x-label ${isMinorTick(year) ? 'is-minor' : ''}`}
                    style={{ left: `${toXPercent(year)}%` }}
                  >
                    {year}
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
