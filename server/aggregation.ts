// server/aggregation.ts: 集計（世間平均・最低値・最高値）の対象にする回答の判定
// API の回答保存・生成データの投入・集計の作り直し（scripts/db）で共通に使う

// 集計対象とする回答の範囲（正解価格に対する倍率）。この外の回答は保存するが、平均・最低値・最高値には含めない
// 桁の打ち間違い（×10・÷10）やいたずらの極端な値で、世間平均が大きく動かないようにする
export const IN_RANGE_MIN_RATIO = 0.2;
export const IN_RANGE_MAX_RATIO = 5;

/**
 * 回答が集計対象の範囲（正解の 1/5〜5倍）に入っているか
 */
export function isInRange(answer: number, actualPrice: number): boolean {
  return answer >= actualPrice * IN_RANGE_MIN_RATIO && answer <= actualPrice * IN_RANGE_MAX_RATIO;
}
