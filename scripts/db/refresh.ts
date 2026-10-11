// scripts/db/refresh.ts: 回答ログの「集計対象か」（quiz_answers.in_range）を付け直し、集計を作り直す SQL を書き出す
// 使い方: npm run db:refresh:local / npm run db:refresh:remote（このスクリプトで SQL を生成してから D1 に適用する）
// 実行が必要なとき: migration 0003 の適用直後 / 集計対象の範囲（server/aggregation.ts）を変えたとき / 正解価格を更新したとき

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { IN_RANGE_MAX_RATIO, IN_RANGE_MIN_RATIO } from '../../server/aggregation';
import { QUIZ_MASTER } from '../../src/data/quizMaster';

const OUT_PATH = 'scripts/db/out/refresh.sql';
const REBUILD_SQL_PATH = 'scripts/db/rebuild_aggregates.sql';

// 設問ごとに、判定が変わる行だけを更新する（書き込み行数を抑えるため）
// 範囲は server/aggregation.ts の isInRange と同じ（両端を含む）
const updates = QUIZ_MASTER.map((q) => {
  const lo = q.actualPrice * IN_RANGE_MIN_RATIO;
  const hi = q.actualPrice * IN_RANGE_MAX_RATIO;
  const flag = `CASE WHEN user_answer >= ${lo} AND user_answer <= ${hi} THEN 1 ELSE 0 END`;
  return `UPDATE quiz_answers SET in_range = ${flag} WHERE question_id = '${q.id}' AND in_range <> ${flag};`;
});

const sql = [
  '-- 集計対象の付け直しと集計の作り直し（scripts/db/refresh.ts が出力。コミットしない）',
  `-- 範囲: 正解の ${IN_RANGE_MIN_RATIO}〜${IN_RANGE_MAX_RATIO} 倍 / 設問数: ${QUIZ_MASTER.length}`,
  ...updates,
  readFileSync(REBUILD_SQL_PATH, 'utf8'),
].join('\n\n');

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${sql}\n`);
console.log(`written: ${OUT_PATH}`);
