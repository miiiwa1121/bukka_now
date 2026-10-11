// scripts/synthetic-data/generate.ts: 架空の回答者の回答を生成し、D1 投入用の SQL を書き出す
// 使い方: npm run synthetic:generate -- [--count 500] [--seed 12345] [--out scripts/synthetic-data/out/insert.sql]
// 生成した行は quiz_submissions.source = 'synthetic'、ID は 'syn_' で始まる（実ユーザーは 'user' / 'sub_'）

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { calculateQuizResult } from '../../server/scoring';
import { QUIZ_MASTER } from '../../src/data/quizMaster';
import type { QuestionData, UserAnswerItem } from '../../src/types/quiz';

// API の回答バリデーションと同じ上限（テンキーの最大8桁）
const MAX_ANSWER_VALUE = 99_999_999;
// 1文あたりの行数（D1 の SQL 文長上限 100KB に収める）
const ROWS_PER_INSERT = 500;
// 正解年（小売物価統計調査の最新年平均）
const LATEST_YEAR = 2025;

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', default: '500' },
    seed: { type: 'string' },
    out: { type: 'string', default: 'scripts/synthetic-data/out/insert.sql' },
  },
});

const count = Number(args.count);
if (!Number.isInteger(count) || count < 1) {
  throw new Error('--count must be a positive integer');
}
const seed = args.seed !== undefined ? Number(args.seed) : Math.floor(Math.random() * 2 ** 31);

/**
 * シード付き乱数（mulberry32）。同じ --seed なら同じ回答が生成される
 */
function createRng(seedValue: number): () => number {
  let a = seedValue >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(seed);
const uniform = (min: number, max: number) => min + (max - min) * rng();
const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];

// 標準正規乱数（Box-Muller）
function gaussian(): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * 回答者の傾向。bias / sigma は対数スケール（exp(bias + sigma * N(0,1)) 倍）
 */
interface Persona {
  name: string;
  weight: number;
  bias: () => number;
  sigma: number;
  // 昔の価格を基準に答える人は、何年前の価格に引っ張られるか
  anchorYearsAgo?: () => number;
}

const PERSONAS: Persona[] = [
  { name: 'accurate', weight: 0.2, bias: () => gaussian() * 0.03, sigma: 0.1 },
  { name: 'average', weight: 0.35, bias: () => gaussian() * 0.06, sigma: 0.22 },
  { name: 'timeslip', weight: 0.2, bias: () => gaussian() * 0.05, sigma: 0.15, anchorYearsAgo: () => Math.round(uniform(5, 20)) },
  { name: 'panic', weight: 0.15, bias: () => uniform(0.12, 0.35), sigma: 0.2 },
  { name: 'rough', weight: 0.1, bias: () => gaussian() * 0.1, sigma: 0.5 },
];

function pickPersona(): Persona {
  let r = rng();
  for (const p of PERSONAS) {
    if ((r -= p.weight) < 0) return p;
  }
  return PERSONAS[PERSONAS.length - 1];
}

/**
 * 指定年に最も近い年の価格（推移がその年までさかのぼれない設問は、いちばん古い年の価格）
 */
function priceNearYear(q: QuestionData, year: number): number {
  let best = q.priceHistory[0];
  for (const point of q.priceHistory) {
    if (Math.abs(point.year - year) < Math.abs(best.year - year)) best = point;
  }
  return best?.price ?? q.actualPrice;
}

/**
 * 人が入力しそうな数字に丸める（キリの良い数・「〜98円」・3桁精度）
 */
function humanRound(x: number): number {
  if (x < 10) return Math.max(1, Math.round(x));
  const magnitude = Math.pow(10, Math.floor(Math.log10(x)));
  const style = rng();
  if (style < 0.4) {
    // キリの良い数（例: 437 → 440 / 450）
    const step = (magnitude / 10) * (rng() < 0.5 ? 1 : 5);
    return Math.max(step, Math.round(x / step) * step);
  }
  if (style < 0.65 && x >= 100) {
    // 値札風（例: 437 → 438 / 4,630 → 4,580 / 19,345 → 18,800）
    const step = magnitude / 10;
    return Math.max(1, Math.round(x / step) * step - step / 5);
  }
  // 有効数字3桁（例: 4,628 → 4,630）
  const step = Math.max(1, magnitude / 100);
  return Math.round(x / step) * step;
}

/**
 * 明らかにおかしい回答（桁の打ち間違い・当てずっぽう・ふざけた値）
 */
function absurdAnswer(base: number): number {
  const kind = rng();
  if (kind < 0.45) return base * 10; // 0 を1つ多く打った
  if (kind < 0.75) return Math.floor(base / 10); // 1桁足りない
  if (kind < 0.9) return humanRound(base * Math.exp(uniform(Math.log(0.05), Math.log(30)))); // 当てずっぽう
  return pick([1, 9999, 12345]);
}

function clampAnswer(x: number): number {
  return Math.min(MAX_ANSWER_VALUE, Math.max(1, Math.round(x)));
}

// ---- 生成 ----

const batchId = `syn_${Date.now()}`;
const submissions: string[] = [];
const answers: string[] = [];
const personaCounts: Record<string, number> = {};

for (let i = 0; i < count; i++) {
  const persona = pickPersona();
  personaCounts[persona.name] = (personaCounts[persona.name] ?? 0) + 1;

  const personBias = persona.bias();
  const anchorYear = persona.anchorYearsAgo ? LATEST_YEAR - persona.anchorYearsAgo() : undefined;
  // うっかり度: 9割の人は 0〜1%、残りは 3〜10% の確率でおかしな値を入れる
  const sloppiness = rng() < 0.9 ? uniform(0, 0.01) : uniform(0.03, 0.1);

  const userAnswers: UserAnswerItem[] = QUIZ_MASTER.map((q) => {
    const base = anchorYear !== undefined ? priceNearYear(q, anchorYear) : q.actualPrice;
    const guess = humanRound(base * Math.exp(personBias + persona.sigma * gaussian()));
    const answer = rng() < sloppiness ? absurdAnswer(guess) : guess;
    return { questionId: q.id, answer: clampAnswer(answer) };
  });

  // 実ユーザーと同じ採点ロジックでスコア・タイプを算出
  const result = calculateQuizResult(userAnswers);
  const submissionId = `${batchId}_${String(i).padStart(4, '0')}`;

  submissions.push(`('${submissionId}', ${result.totalScore}, '${result.senseType.code}', ${result.biasScore}, 'synthetic')`);
  for (const item of result.questionResults) {
    answers.push(`('${submissionId}', '${item.questionId}', ${item.userAnswer}, ${item.errorRate}, ${item.score})`);
  }
}

// ---- SQL 書き出し ----

function chunkedInserts(header: string, rows: string[]): string[] {
  const statements: string[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    statements.push(`${header}\n${rows.slice(i, i + ROWS_PER_INSERT).join(',\n')};`);
  }
  return statements;
}

const sql = [
  `-- 生成データ投入 SQL（scripts/synthetic-data/generate.ts が出力。コミットしない）`,
  `-- batch: ${batchId} / seed: ${seed} / 回答者: ${count}人 × ${QUIZ_MASTER.length}問`,
  ...chunkedInserts('INSERT INTO quiz_submissions (id, total_score, sense_type, bias_score, source) VALUES', submissions),
  ...chunkedInserts('INSERT INTO quiz_answers (submission_id, question_id, user_answer, error_rate, score) VALUES', answers),
  // 設問別集計に今回のバッチ分を加算（API の回答保存時と同じ UPSERT）
  `INSERT INTO item_aggregates (question_id, total_responses, sum_answers, average_answer)
SELECT a.question_id, COUNT(*), SUM(a.user_answer), AVG(a.user_answer)
FROM quiz_answers a
WHERE a.submission_id LIKE '${batchId}\\_%' ESCAPE '\\'
GROUP BY a.question_id
ON CONFLICT(question_id) DO UPDATE SET
  total_responses = total_responses + excluded.total_responses,
  sum_answers = sum_answers + excluded.sum_answers,
  average_answer = (sum_answers + excluded.sum_answers) / (total_responses + excluded.total_responses),
  updated_at = CURRENT_TIMESTAMP;`,
].join('\n\n');

mkdirSync(dirname(args.out!), { recursive: true });
writeFileSync(args.out!, `${sql}\n`);

console.log(`batch: ${batchId}`);
console.log(`seed: ${seed}`);
console.log(`submissions: ${submissions.length} / answers: ${answers.length}`);
console.log(`personas: ${JSON.stringify(personaCounts)}`);
console.log(`written: ${args.out}`);
