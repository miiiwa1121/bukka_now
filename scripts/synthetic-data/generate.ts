// scripts/synthetic-data/generate.ts: 架空の回答者の回答を生成し、D1 投入用の SQL を書き出す
// 使い方:
//   新規投入: npm run synthetic:generate -- [--count 500] [--seed 12345] [--out scripts/synthetic-data/out/insert.sql]
//   作り直し: npm run synthetic:regenerate:local / :remote（-- --dry-run で SQL と分布の表示だけ）
//     既存の生成データの行を残したまま、回答の値（金額・誤差率・設問スコア・集計対象）と診断の総合スコア・タイプ・バイアスを上書きする
//     インデックスのない列だけを更新するので、書き込みは回答1件1行（500人×100問で約5万行）。削除して入れ直すと約30万行になる
// 生成した行は quiz_submissions.source = 'synthetic'、ID は 'syn_' で始まる（実ユーザーは 'user' / 'sub_'）

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { isInRange } from '../../server/aggregation';
import { calculateQuizResult } from '../../server/scoring';
import { QUIZ_MASTER } from '../../src/data/quizMaster';
import type { QuestionData, UserAnswerItem } from '../../src/types/quiz';

// API の回答バリデーションと同じ上限（テンキーの最大8桁）
const MAX_ANSWER_VALUE = 99_999_999;
// 1文あたりの行数（D1 の SQL 文長上限 100KB に収める。更新は CASE が4列ぶん並ぶので少なめ）
const ROWS_PER_INSERT = 500;
const ROWS_PER_UPDATE = 400;
// 正解年（小売物価統計調査の最新年平均）
const LATEST_YEAR = 2025;

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', default: '500' },
    seed: { type: 'string' },
    out: { type: 'string' },
    // 作り直し（既存の生成データを上書き）
    update: { type: 'boolean', default: false },
    remote: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});
const isUpdate = args.update;
const target = args.remote ? '--remote' : '--local';
const outPath = args.out ?? (isUpdate ? 'scripts/synthetic-data/out/update.sql' : 'scripts/synthetic-data/out/insert.sql');

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
 * 実ユーザーの回答（2026-10-11 時点の11件）に合わせて調整した: 誤差（|ln(回答/正解)|）の中央値は約0.4（正解の約1.5倍・3分の2）、
 * 11件中8件が正解より安い。昔の値段の感覚で答える人が多いため、全体に安めに寄せ、昔の価格を基準にする人を多めにする
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
  { name: 'accurate', weight: 0.1, bias: () => gaussian() * 0.05, sigma: 0.2 },
  { name: 'average', weight: 0.35, bias: () => -0.3 + gaussian() * 0.12, sigma: 0.55 },
  { name: 'timeslip', weight: 0.3, bias: () => -0.1 + gaussian() * 0.1, sigma: 0.45, anchorYearsAgo: () => Math.round(uniform(10, 35)) },
  { name: 'panic', weight: 0.1, bias: () => uniform(0.15, 0.45), sigma: 0.45 },
  { name: 'rough', weight: 0.15, bias: () => -0.2 + gaussian() * 0.2, sigma: 0.9 },
];

// 同じペルソナでも人によって相場感の確かさが違う（ばらつきに掛ける倍率）。1人100問の平均で総合スコアが似通わないようにする
const skillSpread = () => uniform(0.6, 1.5);

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

// ---- 作り直しの対象（既存の生成データの ID） ----

/**
 * D1 に問い合わせて結果の行を返す（wrangler の --json 出力）
 */
function queryD1<T>(sql: string): T[] {
  const json = execFileSync('npx', ['wrangler', 'd1', 'execute', 'bukka-now-db', target, '--json', '--command', sql], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return (JSON.parse(json) as { results: T[] }[])[0].results;
}

// 作り直しでは、既存の診断 ID と、回答の行番号（設問ごと）を使う。行番号で更新すれば1行1回の読み取りで済む
let existingIds: string[] = [];
const answerRowIds = new Map<string, number>(); // `${submissionId}|${questionId}` → quiz_answers.id
if (isUpdate) {
  existingIds = queryD1<{ id: string }>("SELECT id FROM quiz_submissions WHERE source = 'synthetic' ORDER BY id").map((r) => r.id);
  for (const row of queryD1<{ id: number; submission_id: string; question_id: string }>(
    `SELECT a.id, a.submission_id, a.question_id FROM quiz_answers a
     JOIN quiz_submissions s ON s.id = a.submission_id WHERE s.source = 'synthetic'`
  )) {
    answerRowIds.set(`${row.submission_id}|${row.question_id}`, row.id);
  }
  if (existingIds.length === 0) throw new Error('作り直す生成データがない（先に synthetic:insert で投入する）');
}

// ---- 生成 ----

const batchId = `syn_${Date.now()}`;
const people = isUpdate ? existingIds.length : count;
const submissions: { id: string; totalScore: number; senseType: string; biasScore: number; questionCount: number }[] = [];
const answers: { submissionId: string; questionId: string; answer: number; errorRate: number; score: number; inRange: number }[] = [];
const personaCounts: Record<string, number> = {};

for (let i = 0; i < people; i++) {
  const persona = pickPersona();
  personaCounts[persona.name] = (personaCounts[persona.name] ?? 0) + 1;

  const personBias = persona.bias();
  const personSigma = persona.sigma * skillSpread();
  const anchorYear = persona.anchorYearsAgo ? LATEST_YEAR - persona.anchorYearsAgo() : undefined;
  // うっかり度: 9割の人は 0〜1%、残りは 3〜10% の確率でおかしな値を入れる
  const sloppiness = rng() < 0.9 ? uniform(0, 0.01) : uniform(0.03, 0.1);

  const userAnswers: UserAnswerItem[] = QUIZ_MASTER.map((q) => {
    const base = anchorYear !== undefined ? priceNearYear(q, anchorYear) : q.actualPrice;
    const guess = humanRound(base * Math.exp(personBias + personSigma * gaussian()));
    const answer = rng() < sloppiness ? absurdAnswer(guess) : guess;
    return { questionId: q.id, answer: clampAnswer(answer) };
  });

  // 実ユーザーと同じ採点ロジックでスコア・タイプを算出
  const result = calculateQuizResult(userAnswers);
  const submissionId = isUpdate ? existingIds[i] : `${batchId}_${String(i).padStart(4, '0')}`;

  submissions.push({
    id: submissionId,
    totalScore: result.totalScore,
    senseType: result.senseType.code,
    biasScore: result.biasScore,
    questionCount: userAnswers.length,
  });
  for (const item of result.questionResults) {
    if (item.userAnswer === null || item.errorRate === null) continue;
    answers.push({
      submissionId,
      questionId: item.questionId,
      answer: item.userAnswer,
      errorRate: item.errorRate,
      score: item.score,
      inRange: isInRange(item.userAnswer, item.actualPrice) ? 1 : 0,
    });
  }
}

// ---- 分布の表示（実ユーザーと比べる目安） ----

const actualPrices = new Map(QUIZ_MASTER.map((q) => [q.id, q.actualPrice]));
const distances = answers.map((a) => Math.abs(Math.log(a.answer / actualPrices.get(a.questionId)!))).sort((x, y) => x - y);
const scores = submissions.map((sub) => sub.totalScore).sort((x, y) => x - y);
const quantile = (xs: number[], q: number) => xs[Math.floor(q * (xs.length - 1))];
const typeCounts: Record<string, number> = {};
for (const sub of submissions) typeCounts[sub.senseType] = (typeCounts[sub.senseType] ?? 0) + 1;
const percentOf = (n: number, total: number) => `${((n / total) * 100).toFixed(0)}%`;

console.log(`seed: ${seed}`);
console.log(`回答者: ${people}人 / 回答: ${answers.length}件 / ペルソナ: ${JSON.stringify(personaCounts)}`);
console.log(
  `誤差 |ln(回答/正解)| の中央値: ${quantile(distances, 0.5).toFixed(2)}（約${Math.exp(quantile(distances, 0.5)).toFixed(2)}倍） / ` +
    `正解より安い回答: ${percentOf(answers.filter((a) => a.answer < actualPrices.get(a.questionId)!).length, answers.length)}`
);
console.log(
  `総合スコア 平均 ${(scores.reduce((x, y) => x + y, 0) / scores.length).toFixed(1)} / ` +
    `10・25・50・75・90%点 ${[0.1, 0.25, 0.5, 0.75, 0.9].map((q) => quantile(scores, q)).join('・')}`
);
console.log(
  `80点以上 ${percentOf(scores.filter((x) => x >= 80).length, scores.length)} / 85点以上 ${percentOf(scores.filter((x) => x >= 85).length, scores.length)} / ` +
    `90点以上 ${percentOf(scores.filter((x) => x >= 90).length, scores.length)} / タイプ ${JSON.stringify(typeCounts)}`
);

// ---- SQL 書き出し ----

function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

const statements: string[] = [];
if (isUpdate) {
  // 行番号で絞り、CASE で値を入れる
  const rows = answers.map((a) => {
    const rowId = answerRowIds.get(`${a.submissionId}|${a.questionId}`);
    if (rowId === undefined) throw new Error(`回答の行が見つからない: ${a.submissionId} ${a.questionId}`);
    return { ...a, rowId };
  });
  for (const part of chunk(rows, ROWS_PER_UPDATE)) {
    const caseOf = (pick: (r: (typeof rows)[number]) => number) => `CASE id ${part.map((r) => `WHEN ${r.rowId} THEN ${pick(r)}`).join(' ')} END`;
    statements.push(
      `UPDATE quiz_answers SET user_answer = ${caseOf((r) => r.answer)}, error_rate = ${caseOf((r) => r.errorRate)}, ` +
        `score = ${caseOf((r) => r.score)}, in_range = ${caseOf((r) => r.inRange)} WHERE id IN (${part.map((r) => r.rowId).join(',')});`
    );
  }
  for (const part of chunk(submissions, ROWS_PER_UPDATE)) {
    const caseOf = (pick: (r: (typeof submissions)[number]) => string | number) => `CASE id ${part.map((r) => `WHEN '${r.id}' THEN ${pick(r)}`).join(' ')} END`;
    statements.push(
      `UPDATE quiz_submissions SET total_score = ${caseOf((r) => r.totalScore)}, sense_type = ${caseOf((r) => `'${r.senseType}'`)}, ` +
        `bias_score = ${caseOf((r) => r.biasScore)}, question_count = ${caseOf((r) => r.questionCount)} WHERE id IN (${part.map((r) => `'${r.id}'`).join(',')});`
    );
  }
} else {
  for (const part of chunk(submissions, ROWS_PER_INSERT)) {
    statements.push(
      `INSERT INTO quiz_submissions (id, total_score, sense_type, bias_score, source, question_count) VALUES\n` +
        part.map((r) => `('${r.id}', ${r.totalScore}, '${r.senseType}', ${r.biasScore}, 'synthetic', ${r.questionCount})`).join(',\n') + ';'
    );
  }
  for (const part of chunk(answers, ROWS_PER_INSERT)) {
    statements.push(
      `INSERT INTO quiz_answers (submission_id, question_id, user_answer, error_rate, score, in_range) VALUES\n` +
        part.map((r) => `('${r.submissionId}', '${r.questionId}', ${r.answer}, ${r.errorRate}, ${r.score}, ${r.inRange})`).join(',\n') + ';'
    );
  }
}

const sql = [
  `-- 生成データ${isUpdate ? '作り直し' : '投入'} SQL（scripts/synthetic-data/generate.ts が出力。コミットしない）`,
  `-- ${isUpdate ? '上書き' : `batch: ${batchId}`} / seed: ${seed} / 回答者: ${people}人 × ${QUIZ_MASTER.length}問`,
  ...statements,
  // 設問別集計とスコア分布を回答ログから作り直す
  readFileSync('scripts/db/rebuild_aggregates.sql', 'utf8'),
].join('\n\n');

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${sql}\n`);
console.log(`written: ${outPath}（最大の文 ${Math.max(...statements.map((st) => st.length)).toLocaleString()} 文字）`);

// 作り直しは続けて D1 に適用する（--remote は wrangler が確認を求める）
if (isUpdate && !args['dry-run']) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'bukka-now-db', target, '--file', outPath], { stdio: 'inherit' });
}
