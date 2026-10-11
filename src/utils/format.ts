// src/utils/format.ts: 結果画面の表示用フォーマット

/**
 * 金額を「1,234円」の形にする。値がない（null）ときは empty を返す
 * 未回答の「あなたの回答」は '未回答'、集計対象の回答がない「全体平均」などは '—' を渡す
 */
export function formatAmount(value: number | null, unit: string, empty = '—'): string {
  return value === null ? empty : `${value.toLocaleString()}${unit}`;
}
