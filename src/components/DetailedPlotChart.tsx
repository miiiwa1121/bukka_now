// src/components/DetailedPlotChart.tsx: 1単位でプロットされた高精度棒グラフコンポーネント
// ホワイトボード調の精密プロット＆インタラクティブな詳細分析

import React, { useMemo, useState } from 'react';
import type { QuestionResultItem } from '../types/quiz';

interface DetailedPlotChartProps {
  item: QuestionResultItem;
  questionIndex: number;
}

interface PlotBarData {
  price: number;
  count: number;
  percent: number;
  isUser: boolean;
  isActual: boolean;
  isAvg: boolean;
}

export const DetailedPlotChart: React.FC<DetailedPlotChartProps> = ({ item, questionIndex }) => {
  const [activeTooltip, setActiveTooltip] = useState<PlotBarData | null>(null);

  // 1単位プロット用のデータを集計
  const { plotData, maxCount, stats } = useMemo(() => {
    // rawAnswers（生の回答値リスト）を取得。なければユーザー回答のみ
    const rawList = item.rawAnswers && item.rawAnswers.length > 0
      ? item.rawAnswers
      : [item.userAnswer];

    // 金額ごとの回答人数をカウント
    const freqMap = new Map<number, number>();
    for (const val of rawList) {
      freqMap.set(val, (freqMap.get(val) || 0) + 1);
    }

    // 必ず含める重要な基準価格（正解・あなた・平均）
    const keyPrices = new Set<number>([
      item.userAnswer,
      item.actualPrice,
      Math.round(item.averageExpected),
      ...Array.from(freqMap.keys()),
    ]);

    // 昇順にソートしたプロット対象リスト
    const sortedPrices = Array.from(keyPrices).sort((a, b) => a - b);
    const totalResponses = rawList.length;

    const bars: PlotBarData[] = sortedPrices.map((price) => {
      const count = freqMap.get(price) || 0;
      const percent = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
      const isUser = price === item.userAnswer;
      const isActual = price === item.actualPrice;
      const isAvg = price === Math.round(item.averageExpected);

      return {
        price,
        count,
        percent,
        isUser,
        isActual,
        isAvg,
      };
    });

    const maxC = Math.max(...bars.map((b) => b.count), 1);

    // 最頻値・中央値などの統計
    const sortedRaw = [...rawList].sort((a, b) => a - b);
    const median = sortedRaw[Math.floor(sortedRaw.length / 2)] ?? item.userAnswer;
    const diffActual = item.userAnswer - item.actualPrice;

    return {
      plotData: bars,
      maxCount: maxC,
      stats: {
        total: totalResponses,
        median,
        diffActual,
      },
    };
  }, [item]);

  // バーの色・スタイルクラスを決定（シマシマ対応）
  const getBarClass = (bar: PlotBarData) => {
    if (bar.isUser && bar.isActual && bar.isAvg) return 'plot-stripe-all';
    if (bar.isUser && bar.isActual) return 'plot-stripe-user-actual';
    if (bar.isUser && bar.isAvg) return 'plot-stripe-user-avg';
    if (bar.isActual && bar.isAvg) return 'plot-stripe-actual-avg';
    if (bar.isUser) return 'plot-bar-user';
    if (bar.isActual) return 'plot-bar-actual';
    if (bar.isAvg) return 'plot-bar-avg';
    if (bar.count > 0) return 'plot-bar-standard';
    return 'plot-bar-ghost';
  };

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
            回答者数: <strong>{stats.total.toLocaleString()}</strong>人
          </span>
        </div>
      </div>

      {/* 統一メトリクスグリッド（4カラム） */}
      <div className="unified-metrics-grid">
        <div className="unified-stat-cell you">
          <span className="unified-stat-label">あなたの回答</span>
          <span className="unified-stat-val">{item.userAnswer.toLocaleString()}{item.unit}</span>
          <span className="unified-stat-sub">
            {stats.diffActual === 0
              ? 'ピタリ正解'
              : stats.diffActual > 0
              ? `+${stats.diffActual.toLocaleString()}${item.unit}（高め）`
              : `${stats.diffActual.toLocaleString()}${item.unit}（安め）`}
          </span>
        </div>

        <div className="unified-stat-cell actual">
          <span className="unified-stat-label">正解（公的相場）</span>
          <span className="unified-stat-val">{item.actualPrice.toLocaleString()}{item.unit}</span>
          <span className="unified-stat-sub">基準価格</span>
        </div>

        <div className="unified-stat-cell avg">
          <span className="unified-stat-label">世間平均予想</span>
          <span className="unified-stat-val">{item.averageExpected.toLocaleString()}{item.unit}</span>
          <span className="unified-stat-sub">全回答者平均</span>
        </div>

        <div className="unified-stat-cell past">
          <span className="unified-stat-label">中央値 / 総回答</span>
          <span className="unified-stat-val">{stats.median.toLocaleString()}{item.unit}</span>
          <span className="unified-stat-sub">総回答数: {stats.total}人</span>
        </div>
      </div>

      {/* 統一グラフコンテナ */}
      <div className="unified-chart-container detailed-chart-container">
        {/* 凡例（レジェンド） */}
        <div className="detailed-plot-legend">
          <span className="legend-chip">
            <span className="color-dot user" /> あなたの回答
          </span>
          <span className="legend-chip">
            <span className="color-dot actual" /> 正解（公的相場）
          </span>
          <span className="legend-chip">
            <span className="color-dot avg" /> 世間平均
          </span>
          <span className="legend-chip">
            <span className="color-dot stripe" /> 重なり
          </span>
          <span className="legend-chip">
            <span className="color-dot general" /> 一般回答
          </span>
        </div>

        {/* 1単位プロット棒グラフエリア（横スクロール可能・ホワイトボード上の方眼プロット） */}
        <div className="detailed-chart-viewport">
        <div className="plot-canvas-grid">
          {/* Y軸の目盛り */}
          <div className="plot-y-axis">
            <span className="y-tick">{maxCount}人</span>
            <span className="y-tick">{Math.ceil(maxCount / 2)}人</span>
            <span className="y-tick">0人</span>
          </div>

          {/* 棒グラフ本体（1単位プロット） */}
          <div className="plot-bars-container">
            {plotData.map((bar) => {
              const heightPercent = bar.count > 0
                ? Math.max(12, Math.round((bar.count / maxCount) * 85))
                : 6; // カウントゼロでも基準価格なら薄く標示
              const barClass = getBarClass(bar);

              return (
                <div
                  key={bar.price}
                  className={`plot-column ${bar.isUser ? 'is-focus-user' : ''} ${bar.isActual ? 'is-focus-actual' : ''}`}
                  onMouseEnter={() => setActiveTooltip(bar)}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() => setActiveTooltip(bar)}
                >
                  {/* 1単位のプロット棒 */}
                  <div className="plot-bar-stem-wrap">
                    <div
                      className={`plot-bar-stem ${barClass}`}
                      style={{ height: `${heightPercent}%` }}
                    >
                      {bar.count > 0 && (
                        <span className="plot-bar-count-label">{bar.count}</span>
                      )}
                    </div>
                  </div>

                  {/* X軸の価格ラベル（1単位の金額） */}
                  <div className="plot-x-label-wrap">
                    <span className={`plot-x-price ${bar.isUser || bar.isActual ? 'highlight' : ''}`}>
                      {bar.price.toLocaleString()}円
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* インタラクティブな詳細吹き出しツールチップ */}
        {activeTooltip && (
          <div className="plot-tooltip-card animate-fade-in">
            <div className="tooltip-title">{activeTooltip.price.toLocaleString()}{item.unit}</div>
            <div className="tooltip-row">
              <span>回答人数:</span>
              <strong>{activeTooltip.count}人 ({activeTooltip.percent}%)</strong>
            </div>
            {activeTooltip.isActual && (
              <div className="tooltip-badge actual">公的統計の正解価格です</div>
            )}
            {activeTooltip.isUser && (
              <div className="tooltip-badge user">あなたの回答です</div>
            )}
            {activeTooltip.isAvg && (
              <div className="tooltip-badge avg">全体の平均予想値です</div>
            )}
          </div>
        )}
      </div>
    </div>

      {/* 統一注記・解説 */}
      {item.priceNote && (
        <p className="unified-note-text">
          <span className="note-strong">品目概要:</span> {item.priceNote}
        </p>
      )}
    </div>
  );
};
