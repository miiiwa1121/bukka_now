// src/components/PriceTrendChart.tsx: 物価の推移・価格変動折れ線グラフコンポーネント
// 過去（2020年等）から現在公的相場（2026年）への推移折れ線グラフと、あなたの感覚・世間平均の位置を可視化

import React from 'react';
import type { QuestionResultItem } from '../types/quiz';
import { QUIZ_MASTER } from '../data/quizMaster';

interface PriceTrendChartProps {
  item: QuestionResultItem;
  questionIndex: number;
}

export const PriceTrendChart: React.FC<PriceTrendChartProps> = ({ item, questionIndex }) => {
  // itemにpastPriceがない場合はQUIZ_MASTERからフォールバック取得
  const masterItem = QUIZ_MASTER.find((q) => q.id === item.questionId);
  const pastPrice = item.pastPrice ?? masterItem?.pastPrice ?? Math.round(item.actualPrice * 0.8);
  const pastYear = item.pastPriceYear ?? masterItem?.pastPriceYear ?? '2020年';

  const currentPrice = item.actualPrice;
  const userPrice = item.userAnswer;
  const avgPrice = Math.round(item.averageExpected);

  // 価格変動
  const priceDiff = currentPrice - pastPrice;
  const changeRate = pastPrice > 0 ? ((priceDiff / pastPrice) * 100).toFixed(1) : '0';
  const isIncreased = priceDiff >= 0;

  // ユーザー回答の立ち位置評価
  const userDiffFromCurrent = userPrice - currentPrice;
  const userDiffFromPast = userPrice - pastPrice;

  let sensePositionLabel = '';
  if (Math.abs(userDiffFromCurrent) <= currentPrice * 0.05) {
    sensePositionLabel = '現在の最新相場にピタリ一致';
  } else if (Math.abs(userDiffFromPast) <= pastPrice * 0.05) {
    sensePositionLabel = `${pastYear}当時の旧相場感覚`;
  } else if (userPrice < pastPrice) {
    sensePositionLabel = `${pastYear}よりもさらに昔の安値感覚`;
  } else if (userPrice < currentPrice) {
    sensePositionLabel = `${pastYear}〜現在の値上げ移行期間の感覚`;
  } else {
    sensePositionLabel = '現在相場を上回る未来のインフレ予測感覚';
  }

  // --------------------------------------------------------------------------
  // 折れ線グラフ用データ（2020年 ➔ 2022年 ➔ 2024年 ➔ 2026年）
  // --------------------------------------------------------------------------
  // 中間年（2022年、2024年）の物価推移ステップ値を補間
  const midPrice2022 = Math.round(pastPrice + (currentPrice - pastPrice) * 0.28);
  const midPrice2024 = Math.round(pastPrice + (currentPrice - pastPrice) * 0.72);

  const timelineYears = [pastYear, '2022年', '2024年', '2026年 (現在)'];
  const trendPrices = [pastPrice, midPrice2022, midPrice2024, currentPrice];

  // SVG座標系パラメータ（viewBox="0 0 680 250"）
  const svgWidth = 680;
  const svgHeight = 250;
  const padLeft = 75;
  const padRight = 85;
  const padTop = 38;
  const padBottom = 45;

  const chartW = svgWidth - padLeft - padRight; // 520
  const chartH = svgHeight - padTop - padBottom; // 167

  // Y軸のスケール計算（最小値・最大値を包含）
  const allValues = [...trendPrices, userPrice, avgPrice];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || 1;
  const marginY = Math.max(span * 0.18, 10);

  const plotMin = Math.max(0, Math.floor((rawMin - marginY) / 10) * 10);
  const plotMax = Math.ceil((rawMax + marginY) / 10) * 10;
  const totalRange = plotMax - plotMin || 1;

  const getY = (val: number) => {
    const clamped = Math.max(plotMin, Math.min(plotMax, val));
    return padTop + chartH - ((clamped - plotMin) / totalRange) * chartH;
  };

  const getX = (index: number) => {
    return padLeft + (chartW / (timelineYears.length - 1)) * index;
  };

  // 折れ線の各ポイント座標
  const linePoints = trendPrices.map((price, idx) => ({
    x: getX(idx),
    y: getY(price),
    price,
    year: timelineYears[idx],
  }));

  // SVGパス文字列
  const pathD = linePoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  // 塗りつぶしエリアパス文字列
  const areaD = `${pathD} L ${linePoints[linePoints.length - 1].x} ${padTop + chartH} L ${linePoints[0].x} ${padTop + chartH} Z`;

  // 2026年時点の特別プロット（X座標 = linePoints[3].x）
  const currentX = getX(3);
  const userY = getY(userPrice);
  const avgY = getY(avgPrice);
  const currentY = getY(currentPrice);

  // Y軸の目盛り値（4分割）
  const gridCount = 3;
  const gridTicks = Array.from({ length: gridCount + 1 }, (_, i) => {
    const val = Math.round(plotMin + (totalRange / gridCount) * i);
    return { val, y: getY(val) };
  });

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
          <span className="unified-stat-val">{userPrice.toLocaleString()}{item.unit}</span>
          <span className="unified-stat-sub">{sensePositionLabel}</span>
        </div>

        <div className="unified-stat-cell actual">
          <span className="unified-stat-label">現在の公的相場</span>
          <span className="unified-stat-val">{currentPrice.toLocaleString()}{item.unit}</span>
          <span className="unified-stat-sub">現在（2026年）</span>
        </div>

        <div className="unified-stat-cell avg">
          <span className="unified-stat-label">世間平均予想</span>
          <span className="unified-stat-val">{avgPrice.toLocaleString()}{item.unit}</span>
          <span className="unified-stat-sub">全回答者平均</span>
        </div>

        <div className="unified-stat-cell past">
          <span className="unified-stat-label">{pastYear}の相場</span>
          <span className="unified-stat-val">{pastPrice.toLocaleString()}{item.unit}</span>
          <span className="unified-stat-sub">
            {isIncreased ? `+${priceDiff.toLocaleString()}${item.unit}上昇` : `${priceDiff.toLocaleString()}${item.unit}`}
          </span>
        </div>
      </div>

      {/* 物価推移折れ線グラフコンテナ */}
      <div className="unified-chart-container trend-line-chart-container">
        <svg
          className="trend-line-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${item.title}の物価推移折れ線グラフ`}
        >
          <defs>
            {/* 折れ線下の温かみのあるエクリュグラデーション塗り */}
            <linearGradient id={`trend-grad-${item.questionId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e03c31" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#e03c31" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Y軸グリッド線 & 目盛りラベル */}
          {gridTicks.map((tick, i) => (
            <g key={i} className="grid-tick-group">
              <line
                x1={padLeft}
                y1={tick.y}
                x2={padLeft + chartW}
                y2={tick.y}
                stroke="#e2dec9"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text
                x={padLeft - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="grid-tick-text"
              >
                {tick.val.toLocaleString()}{item.unit}
              </text>
            </g>
          ))}

          {/* X軸の底面基準線 */}
          <line
            x1={padLeft}
            y1={padTop + chartH}
            x2={padLeft + chartW}
            y2={padTop + chartH}
            stroke="#121212"
            strokeWidth="1.5"
          />

          {/* X軸年ラベル */}
          {timelineYears.map((year, idx) => (
            <text
              key={idx}
              x={getX(idx)}
              y={padTop + chartH + 24}
              textAnchor="middle"
              className={`timeline-year-text ${idx === 3 ? 'is-current' : ''}`}
            >
              {year}
            </text>
          ))}

          {/* エリア塗りつぶし */}
          <path d={areaD} fill={`url(#trend-grad-${item.questionId})`} />

          {/* 公的物価推移折れ線（メインソリッドライン） */}
          <path
            d={pathD}
            fill="none"
            stroke="#121212"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 推移ポイント（2020年、2022年、2024年） */}
          {linePoints.slice(0, 3).map((pt, idx) => (
            <g key={idx} className="trend-point-group">
              <circle
                cx={pt.x}
                y={pt.y}
                r="4.5"
                fill="#ffffff"
                stroke="#121212"
                strokeWidth="2.5"
              />
              {/* 過去年の価格ラベル */}
              {idx === 0 && (
                <text
                  x={pt.x}
                  y={pt.y - 12}
                  textAnchor="middle"
                  className="trend-point-label past-label"
                >
                  {pt.price.toLocaleString()}{item.unit}
                </text>
              )}
            </g>
          ))}

          {/* 2026年公的相場ポイント（正解） */}
          <g className="trend-point-group current-actual-group">
            <circle
              cx={currentX}
              cy={currentY}
              r="6"
              fill="#121212"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
            {/* 正解ラベル吹き出し */}
            <rect
              x={currentX + 10}
              y={currentY - 12}
              width="68"
              height="22"
              rx="4"
              fill="#121212"
            />
            <text
              x={currentX + 44}
              y={currentY + 3}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="11"
              fontWeight="800"
            >
              正解 {currentPrice.toLocaleString()}{item.unit}
            </text>
          </g>

          {/* あなたの回答プロット（2026年） */}
          <g className="trend-point-group user-plot-group">
            {/* 現在相場との乖離点線 */}
            {userPrice !== currentPrice && (
              <line
                x1={currentX}
                y1={currentY}
                x2={currentX}
                y2={userY}
                stroke="#e03c31"
                strokeWidth="1.8"
                strokeDasharray="3,3"
              />
            )}
            <circle
              cx={currentX}
              cy={userY}
              r="7.5"
              fill="#e03c31"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
            {/* あなたラベル吹き出し */}
            <rect
              x={currentX - 84}
              y={userY - 12}
              width="76"
              height="22"
              rx="4"
              fill="#e03c31"
            />
            <text
              x={currentX - 46}
              y={userY + 3}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="11"
              fontWeight="900"
            >
              あなた {userPrice.toLocaleString()}{item.unit}
            </text>
          </g>

          {/* 世間平均プロット（2026年） */}
          {avgPrice !== currentPrice && avgPrice !== userPrice && (
            <g className="trend-point-group avg-plot-group">
              <circle
                cx={currentX}
                cy={avgY}
                r="5"
                fill="#2b5c8f"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      {/* 統一凡例（レジェンド） */}
      <div className="unified-chart-legend">
        <span className="legend-chip">
          <span className="legend-line actual-line" /> 公的物価推移（正解）
        </span>
        <span className="legend-chip">
          <span className="legend-dot user-dot" /> あなたの回答
        </span>
        <span className="legend-chip">
          <span className="legend-dot avg-dot" /> 世間平均
        </span>
        <span className="legend-chip">
          <span className="legend-dot past-dot" /> {pastYear}基準相場
        </span>
      </div>

      {/* 統一注記・要因解説 */}
      {item.priceNote && (
        <p className="unified-note-text">
          <span className="note-strong">物価背景・要因:</span> {item.priceNote}
        </p>
      )}
    </div>
  );
};
