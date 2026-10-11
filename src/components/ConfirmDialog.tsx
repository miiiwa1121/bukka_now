// src/components/ConfirmDialog.tsx: 確認ダイアログ（<dialog> の showModal を使う。Esc で閉じ、フォーカスはダイアログ内に閉じる）
// 開くとブラウザが最初のボタン（キャンセル側）にフォーカスを移す

import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // open に合わせてモーダルを開閉する
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        // Esc キー。ブラウザに閉じさせず、状態（open）から閉じる
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 className="confirm-dialog-title" id="confirm-dialog-title">{title}</h2>
      <p className="confirm-dialog-text">{message}</p>
      <div className="confirm-dialog-actions">
        <button type="button" className="btn-subtle" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className="btn-primary confirm-dialog-confirm" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
};
