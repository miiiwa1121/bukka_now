// src/components/DetailedPlotChart.tsx: 1円単位でプロットした回答分布の縦棒グラフ（面2）
// 面1（DistributionBarChart）と同じパネル・凡例・配色・目盛りグリッド線で描画する
// 棒を押す（マウスはホバー）・←→キーで、その金額と人数を吹き出しで表示する（面3の折れ線と同じ吹き出し）

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { QuestionResultItem } from '../types/quiz';
import { formatAmount } from '../utils/format';
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
// 吹き出しと、見えている範囲の端との最小の間隔（px）
const TOOLTIP_EDGE_GAP = 4;

/**
 * 目盛りの最大値（人）。目盛りが整数になるよう4の倍数に切り上げる（最小4）
 */
function getScaleMax(maxCount: number): number {
  return Math.max(GRID_DIVISIONS, Math.ceil(maxCount / GRID_DIVISIONS) * GRID_DIVISIONS);
}

export const DetailedPlotChart: React.FC<DetailedPlotChartProps> = ({ item, questionIndex }) => {
  const averagePrice = item.averageExpected;

  // 1円単位プロット用のデータを集計
  const { plotData, median } = useMemo(() => {
    // rawAnswers は直近の回答＋自分の回答（未回答なら自分の分はない）
    const rawList = item.rawAnswers;

    // 金額ごとの回答人数をカウント
    const freqMap = new Map<number, number>();
    for (const val of rawList) {
      freqMap.set(val, (freqMap.get(val) || 0) + 1);
    }

    // 回答があった金額に加え、正解・あなた・平均の金額は必ず軸に含める
    const prices = new Set<number>(
      [item.userAnswer, item.actualPrice, averagePrice, ...freqMap.keys()].filter((p): p is number => p !== null)
    );

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
      median: sortedRaw.length > 0 ? sortedRaw[Math.floor(sortedRaw.length / 2)] : null,
    };
  }, [item, averagePrice]);

  const scaleMax = getScaleMax(Math.max(...plotData.map((b) => b.count)));
  const ticks = Array.from({ length: GRID_DIVISIONS + 1 }, (_, i) => (scaleMax / GRID_DIVISIONS) * i);

  // 吹き出しを出している棒（初期表示はあなたの回答。未回答なら正解）
  const initialIndex = Math.max(
    0,
    plotData.findIndex((b) => (item.userAnswer !== null ? b.hasUserAnswer : b.hasActualPrice))
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const lastIndex = plotData.length - 1;
  const scrollRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);

  /**
   * 吹き出しが見えている範囲（Y軸ラベルの右〜スクロール枠の右）からはみ出す分だけ、横にずらす
   * 狭い画面や横スクロール中でも切れないようにする。幅は描画後に実測する（状態は持たず、style.translate を直接書き換える）
   */
  const positionTooltip = useCallback(() => {
    const tooltip = tooltipRef.current;
    const scroller = scrollRef.current;
    if (!tooltip || !scroller) return;
    tooltip.style.translate = '0px 0px';
    const tooltipRect = tooltip.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const left = (axisRef.current?.getBoundingClientRect().right ?? scrollerRect.left) + TOOLTIP_EDGE_GAP;
    const right = scrollerRect.right - TOOLTIP_EDGE_GAP;
    let dx = 0;
    if (tooltipRect.width > right - left || tooltipRect.left < left) dx = left - tooltipRect.left;
    else if (tooltipRect.right > right) dx = right - tooltipRect.right;
    tooltip.style.translate = `${Math.round(dx)}px 0px`;
  }, []);

  /**
   * 棒を選ぶ。reveal（キーボード操作）のときは、見えていない棒を見える位置までスクロールする
   */
  const selectBar = (index: number, reveal = false) => {
    const scroller = scrollRef.current;
    const column = columnRefs.current[index];
    if (reveal && scroller && column) {
      const scrollerRect = scroller.getBoundingClientRect();
      const columnRect = column.getBoundingClientRect();
      const left = axisRef.current?.getBoundingClientRect().right ?? scrollerRect.left;
      if (columnRect.left < left) scroller.scrollLeft -= left - columnRect.left;
      else if (columnRect.right > scrollerRect.right) scroller.scrollLeft += columnRect.right - scrollerRect.right;
    }
    setSelectedIndex(index);
  };

  // 選択が変わるたびに（描画後・表示前に）吹き出しの位置を合わせる
  useLayoutEffect(() => {
    positionTooltip();
  }, [positionTooltip, selectedIndex, plotData]);

  // 横スクロールする場合、初期表示の棒が見える位置までずらす（ページの縦スクロールは動かさない）
  useEffect(() => {
    const scroller = scrollRef.current;
    const column = columnRefs.current[initialIndex];
    if (!scroller || !column || scroller.scrollWidth <= scroller.clientWidth) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const columnRect = column.getBoundingClientRect();
    scroller.scrollLeft += columnRect.left + columnRect.width / 2 - (scrollerRect.left + scrollerRect.width / 2);
  }, [initialIndex]);

  const barLabel = (bar: PlotBarData) => {
    const tags = [bar.hasUserAnswer && 'あなた', bar.hasActualPrice && '正解', bar.hasAverageExpected && '平均値'].filter(Boolean);
    return `${bar.price.toLocaleString()}${item.unit} ${bar.count}人${tags.length > 0 ? `（${tags.join('・')}）` : ''}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectBar(Math.max(0, selectedIndex - 1), true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectBar(Math.min(lastIndex, selectedIndex + 1), true);
    }
  };

  const selected = plotData[Math.min(selectedIndex, lastIndex)];
  const selectedX = ((selectedIndex + 0.5) / plotData.length) * 100;
  const selectedY = selected.count > 0 ? (selected.count / scaleMax) * 100 : 0;

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
          <span className="unified-stat-label">中央値</span>
          <span className="unified-stat-val">{formatAmount(median, item.unit)}</span>
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
          <div className="vplot-scroll" ref={scrollRef} onScroll={positionTooltip}>
            <div className="vplot-content" style={{ minWidth: `calc(var(--vplot-axis-w) + ${plotData.length} * var(--vplot-col-min-w))` }}>
              {/* Y軸の目盛りラベル（人数） */}
              <div className="vplot-y-axis" ref={axisRef} aria-hidden="true">
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

                  {/* 棒を押す・ホバー・←→キーで選ぶ。グラフ上の操作はボード切り替えのスワイプ・ドラッグとして扱わせない */}
                  <div
                    className="vplot-columns"
                    role="slider"
                    tabIndex={0}
                    aria-label={`${item.title}の回答分布`}
                    aria-valuemin={plotData[0].price}
                    aria-valuemax={plotData[lastIndex].price}
                    aria-valuenow={selected.price}
                    aria-valuetext={barLabel(selected)}
                    onKeyDown={handleKeyDown}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    {plotData.map((bar, index) => {
                      const heightPercent = (bar.count / scaleMax) * 100;
                      return (
                        <div
                          key={bar.price}
                          ref={(el) => {
                            columnRefs.current[index] = el;
                          }}
                          className={`vplot-column${index === selectedIndex ? ' is-selected' : ''}`}
                          // タッチはタップで選ぶ（なぞって追従させると横スクロールと取り合うため）
                          onPointerDown={() => selectBar(index)}
                          onPointerEnter={(e) => {
                            if (e.pointerType === 'mouse') selectBar(index);
                          }}
                        >
                          <div
                            className={`vplot-bar ${getBarColorClass(bar)}${bar.count === 0 ? ' is-zero' : ''}`}
                            style={{ height: bar.count > 0 ? `${heightPercent}%` : undefined }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* 選択中の棒の金額と人数（上部に余裕がない場合は下側。見えている範囲からはみ出す分は positionTooltip でずらす） */}
                  <span
                    ref={tooltipRef}
                    className={`chart-tooltip ${selectedY > 70 ? 'is-below' : ''}`}
                    style={{ left: `${selectedX}%`, bottom: selected.count > 0 ? `${selectedY}%` : '5px' }}
                    aria-hidden="true"
                  >
                    {barLabel(selected)}
                  </span>
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
