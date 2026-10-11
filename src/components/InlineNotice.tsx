// src/components/InlineNotice.tsx: 画面内のお知らせ（エラー・案内）。alert() の代わりに使う

import React from 'react';

interface InlineNoticeProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

export const InlineNotice: React.FC<InlineNoticeProps> = ({ message, actionLabel, onAction, actionDisabled = false }) => {
  return (
    <div className="inline-notice" role="alert">
      <span className="inline-notice-dot" aria-hidden="true" />
      <p className="inline-notice-text">{message}</p>
      {onAction && actionLabel && (
        <button type="button" className="btn-primary inline-notice-action" onClick={onAction} disabled={actionDisabled}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};
