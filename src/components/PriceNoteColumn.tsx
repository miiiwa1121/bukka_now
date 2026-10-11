// src/components/PriceNoteColumn.tsx: 設問カード最下部の「コラム」（価格の背景解説）
// 面1・面2・面3 で同一の内容・同一の高さになるよう、3面すべてこのコンポーネントで描画する

import React from 'react';

interface PriceNoteColumnProps {
  note: string;
}

export const PriceNoteColumn: React.FC<PriceNoteColumnProps> = ({ note }) => {
  if (!note) return null;

  return (
    <aside className="price-note-column">
      <span className="price-note-column-label">コラム</span>
      <p className="price-note-column-text">{note}</p>
    </aside>
  );
};
