// scripts/db/rescore.ts: 保存済みの全診断の総合スコア・バイアス・タイプを、現在の採点式で計算し直す
// 使い方: npm run db:rescore:local / npm run db:rescore:remote（--dry-run で SQL の書き出しと集計の表示だけ）
// 実行が必要なとき: 採点式（server/scoring.ts の scoreQuestion）を変えたとき / 正解価格を更新したとき
//
// - 回答ログ（quiz_answers.user_answer）から設問スコアを出し直し、出題数（quiz_submissions.question_count）で割って総合スコアにする
//   未回答（回答ログに行がない設問）は0点。question_count がない行は回答ログの行数を出題数とみなす
// - バイアスは回答した設問の answerBias（比率の対数）の平均
// - 現在のマスターにない設問（以前の問題ID）は、保存されている設問スコアをそのまま使い、バイアスには含めない
// - quiz_answers.score（採点した時点の設問スコア）は書き換えない（約5万行の書き込みになるため）
// - 最後に scripts/db/rebuild_aggregates.sql で score_counts（上位%・累計回答者数の元）を作り直す

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { answerBias, determineSenseType, scoreQuestion } from '../../server/scoring';
import { QUIZ_MASTER } from '../../src/data/quizMaster';

const { values: args } = parseArgs({
  options: {
    remote: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});
const target = args.remote ? '--remote' : '--local';
const OUT_PATH = 'scripts/db/out/rescore.sql';

interface Row {
  id: string;
  total_score: number;
  sense_type: string;
  bias_score: number;
  question_count: number | null;
  question_id: string | null;
  user_answer: number | null;
  score: number | null;
}

// 1. D1 から診断と回答を読む（全回答数ぶんの読み取り）
const json = execFileSync(
  'npx',
  [
    'wrangler', 'd1', 'execute', 'bukka-now-db', target, '--json', '--command',
    `SELECT s.id, s.total_score, s.sense_type, s.bias_score, s.question_count, a.question_id, a.user_answer, a.score
     FROM quiz_submissions s LEFT JOIN quiz_answers a ON a.submission_id = s.id`,
  ],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }
);
const rows = (JSON.parse(json) as { results: Row[] }[])[0].results;

// 2. 診断ごとに計算し直す
const actualPrices = new Map(QUIZ_MASTER.map((q) => [q.id, q.actualPrice]));
const submissions = new Map<string, { old: Row; sum: number; answered: number; biasSum: number; biasCount: number }>();
for (const row of rows) {
  const entry = submissions.get(row.id) ?? { old: row, sum: 0, answered: 0, biasSum: 0, biasCount: 0 };
  if (row.question_id !== null && row.user_answer !== null) {
    const actual = actualPrices.get(row.question_id);
    if (actual !== undefined) {
      entry.sum += scoreQuestion(row.user_answer, actual);
      entry.biasSum += answerBias(row.user_answer, actual);
      entry.biasCount++;
    } else {
      entry.sum += row.score ?? 0;
    }
    entry.answered++;
  }
  submissions.set(row.id, entry);
}

const updates: string[] = [];
const before: number[] = [];
const after: number[] = [];
const typesBefore: Record<string, number> = {};
const typesAfter: Record<string, number> = {};
for (const [id, { old, sum, answered, biasSum, biasCount }] of submissions) {
  const questionCount = old.question_count ?? answered;
  const totalScore = questionCount > 0 ? Math.round(sum / questionCount) : 0;
  const biasScore = biasCount > 0 ? Number((biasSum / biasCount).toFixed(3)) : old.bias_score;
  const { typeKey } = determineSenseType(totalScore, biasScore);
  before.push(old.total_score);
  after.push(totalScore);
  typesBefore[old.sense_type] = (typesBefore[old.sense_type] ?? 0) + 1;
  typesAfter[typeKey] = (typesAfter[typeKey] ?? 0) + 1;
  if (totalScore !== old.total_score || typeKey !== old.sense_type || biasScore !== old.bias_score) {
    updates.push(
      `UPDATE quiz_submissions SET total_score = ${totalScore}, bias_score = ${biasScore}, sense_type = '${typeKey}' WHERE id = '${id}';`
    );
  }
}

// 3. SQL を書き出す（変わる行だけ更新し、スコア分布を作り直す）
const sql = [
  '-- 総合スコア・タイプの計算し直し（scripts/db/rescore.ts が出力。コミットしない）',
  `-- 対象: ${submissions.size}件 / 更新: ${updates.length}件`,
  ...updates,
  readFileSync('scripts/db/rebuild_aggregates.sql', 'utf8'),
].join('\n\n');
mkdirSync('scripts/db/out', { recursive: true });
writeFileSync(OUT_PATH, `${sql}\n`);

const avg = (xs: number[]) => (xs.length > 0 ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '-');
console.log(`診断 ${submissions.size}件 / 更新 ${updates.length}件`);
console.log(`総合スコアの平均: ${avg(before)} → ${avg(after)}`);
console.log(`タイプ: ${JSON.stringify(typesBefore)} → ${JSON.stringify(typesAfter)}`);
console.log(`written: ${OUT_PATH}`);

// 4. 適用する（--remote は wrangler が確認を求める）
if (!args['dry-run']) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'bukka-now-db', target, '--file', OUT_PATH], { stdio: 'inherit' });
}
