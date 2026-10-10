// src/components/LandingView.tsx: シンプル is best なトップビュー

import React from 'react';

interface LandingViewProps {
  questionCount: number;
  onQuestionCountChange: (count: number) => void;
  onStart: () => void;
  totalParticipants?: number;
  isLoading?: boolean;
}

const COUNT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export const LandingView: React.FC<LandingViewProps> = ({
  questionCount,
  onQuestionCountChange,
  onStart,
  totalParticipants = 1420,
  isLoading = false,
}) => {
  return (
    <div className="landing-minimal animate-fade-in" id="landing-hero-view">
      {/* 累計回答者数バッジ */}
      <div className="participants-stat-pill" id="total-participants-stat">
        <span className="stat-dot" />
        <span>累計回答者数: <strong>{totalParticipants.toLocaleString()}</strong> 人</span>
      </div>

      <h1 className="minimal-title">
        物価意識スコア診断
      </h1>

      <p className="minimal-desc">
        日用品・食品・サービスの相場価格をテンキーで入力。<br />
        あなたの物価感覚が「上位何％」かをリアルタイム回答分布から測定します。
      </p>

      {/* 設問数選択（10〜100問・10問単位） */}
      <div className="minimal-selector-box" id="question-count-selector">
        <div className="minimal-selector-label">出題数を選択</div>
        <div className="count-chips-grid">
          {COUNT_OPTIONS.map((count) => {
            const isSelected = questionCount === count;
            return (
              <button
                key={count}
                type="button"
                className={`count-chip-btn ${isSelected ? 'active' : ''}`}
                id={`btn-count-${count}`}
                onClick={() => onQuestionCountChange(count)}
              >
                <span className="chip-num">{count}</span>
                <span className="chip-unit">問</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* スタートボタン */}
      <div className="minimal-cta-wrap">
        <button
          className="btn-primary minimal-start-btn"
          id="btn-start-quiz"
          onClick={onStart}
          disabled={isLoading}
        >
          {isLoading ? '準備中...' : `診断を開始する（全${questionCount}問）`}
        </button>
      </div>
    </div>
  );
};
