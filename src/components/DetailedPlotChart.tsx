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
    <div className="detailed-plot-card" id={`detailed-plot-${item.questionId}`}>
      {/* 設問ヘッダー */}
      <div className="detailed-plot-header">
        <div className="detailed-q-badge">
          <span className="q-tag">Q{questionIndex + 1}</span>
          <span className="q-category">{item.categoryLabel}</span>
        </div>
        <h3 className="detailed-plot-title">{item.title}</h3>
        <p className="detailed-plot-note">{item.priceNote}</p>
      </div>

      {/* サマリーメトリクス（ホワイトボード風メモ） */}
      <div className="plot-stats-ribbon">
        <div className="plot-stat-chip you">
          <span className="stat-chip-label">あなたの回答</span>
          <span className="stat-chip-val">{item.userAnswer.toLocaleString()}{item.unit}</span>
          <span className="stat-chip-sub">
            {stats.diffActual === 0
              ? 'ピタリ正解'
              : stats.diffActual > 0
              ? `+${stats.diffActual.toLocaleString()}${item.unit}（高め）`
              : `${stats.diffActual.toLocaleString()}${item.unit}（安め）`}
          </span>
        </div>

        <div className="plot-stat-chip actual">
          <span className="stat-chip-label">正解（公的相場）</span>
          <span className="stat-chip-val">{item.actualPrice.toLocaleString()}{item.unit}</span>
          <span className="stat-chip-sub">基準価格</span>
        </div>

        <div className="plot-stat-chip avg">
          <span className="stat-chip-label">世間平均予想</span>
          <span className="stat-chip-val">{item.averageExpected.toLocaleString()}{item.unit}</span>
          <span className="stat-chip-sub">全回答者平均</span>
        </div>

        <div className="plot-stat-chip total">
          <span className="stat-chip-label">総回答数</span>
          <span className="stat-chip-val">{stats.total}人</span>
          <span className="stat-chip-sub">中央値: {stats.median.toLocaleString()}{item.unit}</span>
        </div>
      </div>

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
                  {/* 頭上のマーカーラベル（あなた・正解・平均） */}
                  <div className="plot-flag-marker">
                    {bar.isUser && bar.isActual ? (
                      <span className="flag-bubble match">正解一致</span>
                    ) : bar.isUser ? (
                      <span className="flag-bubble user">あなた</span>
                    ) : bar.isActual ? (
                      <span className="flag-bubble actual">正解</span>
                    ) : bar.isAvg ? (
                      <span className="flag-bubble avg">平均</span>
                    ) : null}
                  </div>

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
  );
};
