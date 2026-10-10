// src/components/Header.tsx: 共通ヘッダーコンポーネント（絵文字不使用）

import React from 'react';

interface HeaderProps {
  onReset?: () => void;
  showReset?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onReset, showReset = false }) => {
  return (
    <header className="app-header" id="app-header">
      <div
        className="brand-badge"
        id="brand-logo"
        onClick={onReset}
        role="button"
        tabIndex={0}
      >
        <svg className="brand-svg-icon" width="28" height="28" viewBox="0 0 32 32" fill="none">
          {/* unpis風の太線ラインアート & 朱赤アクセント */}
          <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="#191919" strokeWidth="2.2" />
          <path d="M9 20L14 14L19 17L23 11" stroke="#191919" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="23" cy="11" r="3" fill="#eb4634" stroke="#191919" strokeWidth="1.8" />
        </svg>
        <span className="brand-title">bukka_now</span>
      </div>

      {showReset && (
        <button
          className="btn-subtle"
          id="btn-header-reset"
          onClick={onReset}
          style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
        >
          最初に戻る
        </button>
      )}
    </header>
  );
};
