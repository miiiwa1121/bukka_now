// src/components/PriceTrendChart.tsx: 物価の推移・価格変動チャートコンポーネント
// 過去（2020年等）から現在公的相場への推移と、あなたの感覚・世間平均の位置を可視化

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

  // タイムライン描画用のスケール計算
  const minVal = Math.min(pastPrice, currentPrice, userPrice, avgPrice);
  const maxVal = Math.max(pastPrice, currentPrice, userPrice, avgPrice);
  const range = maxVal - minVal || 1;
  const paddingRange = range * 0.15;
  const plotMin = Math.max(0, minVal - paddingRange);
  const plotMax = maxVal + paddingRange;
  const totalSpan = plotMax - plotMin || 1;

  const getPositionPercent = (val: number) => {
    return Math.max(4, Math.min(96, ((val - plotMin) / totalSpan) * 100));
  };

  const posPast = getPositionPercent(pastPrice);
  const posCurrent = getPositionPercent(currentPrice);
  const posUser = getPositionPercent(userPrice);
  const posAvg = getPositionPercent(avgPrice);

  return (
    <div className="trend-chart-card" id={`trend-chart-${item.questionId}`}>
      {/* 設問ヘッダー */}
      <div className="trend-card-header">
        <div className="trend-q-badge">
          <span className="q-tag">Q{questionIndex + 1}</span>
          <span className="q-category">{item.categoryLabel}</span>
        </div>
        <h3 className="trend-card-title">{item.title}</h3>
      </div>

      {/* 推移メトリクス（過去 ➔ 現在の変動） */}
      <div className="trend-metrics-grid">
        <div className="trend-metric-box past">
          <span className="metric-box-label">{pastYear}の相場</span>
          <span className="metric-box-val">{pastPrice.toLocaleString()}{item.unit}</span>
          <span className="metric-box-sub">インフレ前基準</span>
        </div>

        <div className="trend-metric-arrow">
          <span className="arrow-badge">
            {isIncreased ? `+${changeRate}%` : `${changeRate}%`}
          </span>
          <span className="arrow-sub">
            {isIncreased ? `+${priceDiff.toLocaleString()}${item.unit}上昇` : `${priceDiff.toLocaleString()}${item.unit}変動`}
          </span>
        </div>

        <div className="trend-metric-box current">
          <span className="metric-box-label">現在の公的相場</span>
          <span className="metric-box-val">{currentPrice.toLocaleString()}{item.unit}</span>
          <span className="metric-box-sub">現在の公定価格</span>
        </div>

        <div className="trend-metric-box user">
          <span className="metric-box-label">あなたの回答</span>
          <span className="metric-box-val">{userPrice.toLocaleString()}{item.unit}</span>
          <span className="metric-box-sub">{sensePositionLabel}</span>
        </div>
      </div>

      {/* 物価推移タイムライン・ゲージ図 */}
      <div className="trend-timeline-container">
        <div className="trend-timeline-track">
          {/* 過去から現在への上昇グラデーション区間 */}
          <div
            className="trend-rise-bar"
            style={{
              left: `${Math.min(posPast, posCurrent)}%`,
              width: `${Math.abs(posCurrent - posPast)}%`,
            }}
          />

          {/* 過去価格ピン */}
          <div className="trend-pin pin-past" style={{ left: `${posPast}%` }}>
            <div className="pin-flag">{pastYear}</div>
            <div className="pin-dot" />
            <div className="pin-price">{pastPrice.toLocaleString()}{item.unit}</div>
          </div>

          {/* 現在公的相場ピン */}
          <div className="trend-pin pin-current" style={{ left: `${posCurrent}%` }}>
            <div className="pin-flag">現在相場</div>
            <div className="pin-dot" />
            <div className="pin-price">{currentPrice.toLocaleString()}{item.unit}</div>
          </div>

          {/* 世間平均ピン */}
          <div className="trend-pin pin-avg" style={{ left: `${posAvg}%` }}>
            <div className="pin-flag">世間平均</div>
            <div className="pin-dot" />
            <div className="pin-price">{avgPrice.toLocaleString()}{item.unit}</div>
          </div>

          {/* あなたの回答ピン（最前面） */}
          <div className="trend-pin pin-user" style={{ left: `${posUser}%` }}>
            <div className="pin-flag">あなた</div>
            <div className="pin-dot" />
            <div className="pin-price">{userPrice.toLocaleString()}{item.unit}</div>
          </div>
        </div>
      </div>

      {/* 物価変動の背景・要因解説 */}
      {item.priceNote && (
        <div className="trend-note-box">
          <span className="note-badge">物価背景・インフレ要因</span>
          <p className="note-text">{item.priceNote}</p>
        </div>
      )}
    </div>
  );
};
