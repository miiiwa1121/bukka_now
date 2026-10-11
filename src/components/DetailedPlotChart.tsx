// src/components/DetailedPlotChart.tsx: 1円単位でプロットした回答分布の縦棒グラフ（面2）
// 面1（DistributionBarChart）と同じパネル・凡例・配色・目盛りグリッド線で描画する
// 金額の種類がいくつあっても全ての棒を枠内に収める（横スクロール・金額ラベルなし）
// 棒を押す・なぞる（マウスはホバー）・←→キーで、その金額と人数を吹き出しで表示する（面3の折れ線と同じ吹き出し）

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const plotRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  /**
   * 吹き出しがグラフの枠（Y軸ラベルの右〜枠の右）からはみ出す分だけ、横にずらす
   * 枠より吹き出しが広い（スマホ幅で付記がある場合など）ときは、付記の手前で折り返す
   * 幅は描画後に実測する（状態は持たず、style を直接書き換える）
   */
  const positionTooltip = useCallback(() => {
    const tooltip = tooltipRef.current;
    const plot = plotRef.current;
    if (!tooltip || !plot) return;
    tooltip.style.translate = '0px 0px';
    tooltip.style.whiteSpace = '';
    tooltip.style.maxWidth = '';
    tooltip.style.lineHeight = '';
    const plotRect = plot.getBoundingClientRect();
    const left = plotRect.left + TOOLTIP_EDGE_GAP;
    const right = plotRect.right - TOOLTIP_EDGE_GAP;
    if (tooltip.getBoundingClientRect().width > right - left) {
      tooltip.style.whiteSpace = 'normal';
      tooltip.style.maxWidth = `${Math.floor(right - left)}px`;
      tooltip.style.lineHeight = '1.35';
    }
    const tooltipRect = tooltip.getBoundingClientRect();
    let dx = 0;
    if (tooltipRect.width > right - left || tooltipRect.left < left) dx = left - tooltipRect.left;
    else if (tooltipRect.right > right) dx = right - tooltipRect.right;
    tooltip.style.translate = `${Math.round(dx)}px 0px`;
  }, []);

  // 選択が変わるたびに（描画後・表示前に）吹き出しの位置を合わせる
  useLayoutEffect(() => {
    positionTooltip();
  }, [positionTooltip, selectedIndex, plotData]);

  /**
   * 押した・なぞった位置の棒を選ぶ（列は等幅なので、横位置から番号を出す。細い棒でも狙わずに選べる）
   */
  const selectAtClientX = (clientX: number) => {
    const rect = columnsRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const index = Math.floor(((clientX - rect.left) / rect.width) * plotData.length);
    setSelectedIndex(Math.min(lastIndex, Math.max(0, index)));
  };

  // 吹き出しの文言。「1,400円 11人」と、あなたの回答・正解・平均値に当たる棒の付記「（あなた・正解）」
  const barLabelParts = (bar: PlotBarData) => {
    const tags = [bar.hasUserAnswer && 'あなた', bar.hasActualPrice && '正解', bar.hasAverageExpected && '平均値'].filter(Boolean);
    return {
      main: `${bar.price.toLocaleString()}${item.unit} ${bar.count}人`,
      tag: tags.length > 0 ? `（${tags.join('・')}）` : '',
    };
  };
  const barLabel = (bar: PlotBarData) => {
    const { main, tag } = barLabelParts(bar);
    return main + tag;
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

          {/* 縦棒グラフ（全ての金額を枠内に詰める。金額ラベルは出さず、吹き出しで示す） */}
          <div className="vplot-scroll plot-fit">
            <div className="vplot-content">
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
              <div className="vplot-area" ref={plotRef}>
                <div className="vplot-inner">
                  {ticks.map((tick) => (
                    <span key={tick} className="vplot-grid-line" style={{ bottom: `${(tick / scaleMax) * 100}%` }} />
                  ))}

                  {/* 押す・なぞる（マウスはホバー）・←→キーで選ぶ。グラフ上の操作はボード切り替えのスワイプ・ドラッグとして扱わせない */}
                  <div
                    ref={columnsRef}
                    className="vplot-columns"
                    role="slider"
                    tabIndex={0}
                    aria-label={`${item.title}の回答分布`}
                    aria-valuemin={plotData[0].price}
                    aria-valuemax={plotData[lastIndex].price}
                    aria-valuenow={selected.price}
                    aria-valuetext={barLabel(selected)}
                    onPointerDown={(e) => selectAtClientX(e.clientX)}
                    onPointerMove={(e) => {
                      // マウスはホバーで、タッチ・ペンは押している間だけ追従
                      if (e.pointerType === 'mouse' || e.buttons > 0) selectAtClientX(e.clientX);
                    }}
                    onKeyDown={handleKeyDown}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    {plotData.map((bar, index) => {
                      const heightPercent = (bar.count / scaleMax) * 100;
                      return (
                        <div key={bar.price} className={`vplot-column${index === selectedIndex ? ' is-selected' : ''}`}>
                          <div
                            className={`vplot-bar ${getBarColorClass(bar)}${bar.count === 0 ? ' is-zero' : ''}`}
                            style={{ height: bar.count > 0 ? `${heightPercent}%` : undefined }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* 選択中の棒の縦線（細い棒でも位置が分かるように。面3と同じ） */}
                  <span className="chart-cursor-line" style={{ left: `${selectedX}%` }} aria-hidden="true" />

                  {/* 選択中の棒の金額と人数（上部に余裕がない場合は下側。枠からはみ出す分は positionTooltip でずらす） */}
                  <span
                    ref={tooltipRef}
                    className={`chart-tooltip ${selectedY > 70 ? 'is-below' : ''}`}
                    style={{ left: `${selectedX}%`, bottom: selected.count > 0 ? `${selectedY}%` : '5px' }}
                    aria-hidden="true"
                  >
                    {barLabelParts(selected).main}
                    {/* 折り返すときは付記の手前で改行する */}
                    {barLabelParts(selected).tag && <span className="chart-tooltip-tag">{barLabelParts(selected).tag}</span>}
                  </span>
                </div>
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
