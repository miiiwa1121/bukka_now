// src/components/NumberKeypad.tsx: 0〜9の数字キーおよびOKボタン型入力インターフェース

import React, { useEffect } from 'react';

interface NumberKeypadProps {
  value: number;
  onChange: (val: number) => void;
  onSubmit: () => void;
  unit?: string;
  disabled?: boolean;
}

export const NumberKeypad: React.FC<NumberKeypadProps> = ({
  value,
  onChange,
  onSubmit,
  unit = '円',
  disabled = false,
}) => {
  // 数字ボタン押下
  const handleDigit = (digit: number) => {
    if (disabled) return;
    const currentStr = value === 0 ? '' : value.toString();
    if (currentStr.length >= 8) return; // 最大8桁
    const nextVal = Number(`${currentStr}${digit}`);
    onChange(nextVal);
  };

  // 1文字消去 (Backspace)
  const handleBackspace = () => {
    if (disabled) return;
    const currentStr = value.toString();
    if (currentStr.length <= 1) {
      onChange(0);
    } else {
      onChange(Number(currentStr.slice(0, -1)));
    }
  };

  // クリア (C)
  const handleClear = () => {
    if (disabled) return;
    onChange(0);
  };

  // 物理キーボード対応
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(Number(e.key));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        // テンキー以外のボタン・リンク（ロゴ、前へ戻る、再送信など）にフォーカスがあるときは、そちらを押させる
        if (e.target instanceof Element && e.target.closest('button, a') && !e.target.closest('#numpad-container')) return;
        e.preventDefault();
        if (value > 0) {
          onSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, disabled, onSubmit]);

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="numpad-container" id="numpad-container">
      {/* 入力値表示ディスプレイ */}
      <div className="numpad-display-box" id="numpad-display-box">
        <span className="numpad-display-label">回答予想額</span>
        <div className="numpad-display-value-wrap">
          <span className="numpad-display-digits" id="numpad-current-value">
            {value > 0 ? value.toLocaleString() : '0'}
          </span>
          <span className="numpad-display-unit">{unit}</span>
        </div>
        <span className="numpad-input-hint">キーボードまたはテンキーで入力</span>
      </div>

      {/* テンキーと決定ボタン（PC ではディスプレイの右の列に並べる） */}
      <div className="numpad-keys-wrap">
        {/* テンキーパッド */}
        <div className="numpad-key-grid">
          {digits.map((d) => (
            <button
              key={d}
              type="button"
              className="numpad-key"
              id={`btn-num-${d}`}
              onClick={() => handleDigit(d)}
              disabled={disabled}
            >
              {d}
            </button>
          ))}

          {/* クリアボタン */}
          <button
            type="button"
            className="numpad-key action-clear"
            id="btn-num-clear"
            onClick={handleClear}
            disabled={disabled}
          >
            C
          </button>

          {/* 0ボタン */}
          <button
            type="button"
            className="numpad-key"
            id="btn-num-0"
            onClick={() => handleDigit(0)}
            disabled={disabled}
          >
            0
          </button>

          {/* バックスペースボタン */}
          <button
            type="button"
            className="numpad-key action-backspace"
            id="btn-num-backspace"
            onClick={handleBackspace}
            disabled={disabled}
          >
            BS
          </button>
        </div>

        {/* OKボタン */}
        <button
          type="button"
          className="btn-primary numpad-ok-btn"
          id="btn-num-ok"
          onClick={onSubmit}
          disabled={value <= 0 || disabled}
        >
          <span>決定（OK）</span>
        </button>
      </div>
    </div>
  );
};
