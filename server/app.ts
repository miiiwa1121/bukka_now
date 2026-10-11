// server/app.ts: Hono API サーバー実装

import { Hono, type Context } from 'hono';
import { QUIZ_MASTER } from '../src/data/quizMaster';
import type { GlobalStatsItem, PublicQuestion, UserAnswerItem } from '../src/types/quiz';
import { isInRange } from './aggregation';
import { calculateQuizResult, type QuestionStats } from './scoring';
import type { Env } from './types';

// CORS は許可しない（画面と API は同じオリジン。他サイトのブラウザから API を使わせない）
export const app = new Hono<{ Bindings: Env }>();

const MASTER_MAP = new Map(QUIZ_MASTER.map((q) => [q.id, q]));

// 1回の送信で受け付ける回答数の上限（出題数の上限と同じ）
const MAX_ANSWERS = 100;
// 回答金額の範囲（テンキーの最大8桁。0円は回答として受け付けない）
const MIN_ANSWER_VALUE = 1;
const MAX_ANSWER_VALUE = 99_999_999;
// 分布ヒストグラム・1単位プロット用に取得する設問ごとの直近回答数
const HISTORY_LIMIT_PER_QUESTION = 500;

interface AggregateRow {
  question_id: string;
  total_responses: number;
  in_range_responses: number;
  sum_answers: number;
  min_answer: number | null;
  max_answer: number | null;
}

/**
 * item_aggregates の行を QuestionStats に変換する
 */
function toQuestionStats(rows: AggregateRow[]): Record<string, QuestionStats> {
  const stats: Record<string, QuestionStats> = {};
  for (const row of rows) {
    stats[row.question_id] = {
      totalResponses: row.total_responses,
      inRangeResponses: row.in_range_responses,
      sumAnswers: row.sum_answers,
      min: row.min_answer,
      max: row.max_answer,
    };
  }
  return stats;
}

/**
 * score_counts の行を「総合スコア → 人数」に変換する
 */
function toScoreCounts(rows: { total_score: number; submissions: number }[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const row of rows) {
    counts[row.total_score] = row.submissions;
  }
  return counts;
}

/**
 * 累計回答者数（診断の回数）。score_counts の合計なので、quiz_submissions を数え直さない
 */
function sumParticipants(scoreCounts: Record<number, number>): number {
  return Object.values(scoreCounts).reduce((sum, n) => sum + n, 0);
}

const AGGREGATE_COLUMNS = 'question_id, total_responses, in_range_responses, sum_answers, min_answer, max_answer';

/**
 * 全設問の集計値と、総合スコアの分布を取得する（読み取りは設問数＋最大101行）
 */
async function loadOverview(db?: D1Database): Promise<{ stats: Record<string, QuestionStats>; scoreCounts: Record<number, number> }> {
  if (!db) {
    return { stats: {}, scoreCounts: {} };
  }
  try {
    const [aggregates, scores] = await db.batch([
      db.prepare(`SELECT ${AGGREGATE_COLUMNS} FROM item_aggregates`),
      db.prepare('SELECT total_score, submissions FROM score_counts'),
    ]);
    return {
      stats: toQuestionStats((aggregates.results ?? []) as unknown as AggregateRow[]),
      scoreCounts: toScoreCounts((scores.results ?? []) as unknown as { total_score: number; submissions: number }[]),
    };
  } catch (err) {
    console.error('Failed to query D1 aggregates:', err);
    return { stats: {}, scoreCounts: {} };
  }
}

/**
 * 回数制限のキー。IPv4 はアドレスそのもの、IPv6 は上位64ビット（/64）
 * IPv6 は1契約に /64 以上がまとめて割り当てられることが多く、アドレス単位だと付け替えて制限を回避できるため
 */
export function rateLimitKey(ip: string | undefined): string {
  if (!ip) return 'unknown';
  // IPv4、または IPv4 射影アドレス（::ffff:192.0.2.1）は末尾の IPv4 で数える
  if (!ip.includes(':')) return ip;
  if (ip.includes('.')) return ip.slice(ip.lastIndexOf(':') + 1);

  // :: の省略を展開して8ブロックにそろえる
  const [head, tail] = ip.toLowerCase().split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const zeros = Array(Math.max(0, 8 - headGroups.length - tailGroups.length)).fill('0');
  const groups = tail !== undefined ? [...headGroups, ...zeros, ...tailGroups] : headGroups;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

/**
 * Fisher–Yates で均等に並べ替えた新しい配列を返す
 * （sort(() => 0.5 - Math.random()) は元の並び順が残り、先頭の設問ほど出やすくなる）
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * IP ごとの回数制限。バインディングがない環境（npm run dev）では制限しない
 */
async function isRateLimited(limiter: RateLimit | undefined, c: Context<{ Bindings: Env }>): Promise<boolean> {
  if (!limiter) return false;
  const key = rateLimitKey(c.req.header('cf-connecting-ip'));
  try {
    const { success } = await limiter.limit({ key });
    return !success;
  } catch (err) {
    // 回数制限の障害でサービスを止めない
    console.error('Rate limiter failed:', err);
    return false;
  }
}

/**
 * 回答送信ボディの検証。問題があればエラーメッセージを返す
 */
function validateAnswers(body: unknown): { answers: UserAnswerItem[] } | { error: string } {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { answers?: unknown }).answers)) {
    return { error: 'Invalid answers format' };
  }

  const rawAnswers = (body as { answers: unknown[] }).answers;
  if (rawAnswers.length === 0 || rawAnswers.length > MAX_ANSWERS) {
    return { error: `answers must contain 1 to ${MAX_ANSWERS} items` };
  }

  const seen = new Set<string>();
  const answers: UserAnswerItem[] = [];

  for (const item of rawAnswers) {
    if (!item || typeof item !== 'object') {
      return { error: 'Invalid answer item' };
    }
    const { questionId, answer } = item as { questionId?: unknown; answer?: unknown };

    if (typeof questionId !== 'string' || !MASTER_MAP.has(questionId)) {
      return { error: 'Unknown questionId' };
    }
    if (seen.has(questionId)) {
      return { error: 'Duplicate questionId' };
    }
    // null は未回答（時間切れで入力なし）
    if (
      answer !== null &&
      (typeof answer !== 'number' || !Number.isInteger(answer) || answer < MIN_ANSWER_VALUE || answer > MAX_ANSWER_VALUE)
    ) {
      return { error: `answer must be null or an integer between ${MIN_ANSWER_VALUE} and ${MAX_ANSWER_VALUE}` };
    }

    seen.add(questionId);
    answers.push({ questionId, answer });
  }

  return { answers };
}

/**
 * GET /api/quiz?count=10
 * クイズ設問一覧を取得
 * カンニング防止のため、正解・解説・正解のヒントになる値（過去価格・世間平均）は返さない
 * 10〜100問の範囲で10問単位で指定可能（デフォルト10問）
 */
app.get('/api/quiz', async (c) => {
  if (await isRateLimited(c.env.READ_RATE_LIMITER, c)) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  const countParam = Number(c.req.query('count')) || 10;
  const count = Math.min(100, Math.max(10, Math.round(countParam / 10) * 10));

  const { stats, scoreCounts } = await loadOverview(c.env.DB);

  // 指定数の問題を均等にシャッフルして抽出
  const shuffled = shuffle(QUIZ_MASTER).slice(0, count);

  const questions: PublicQuestion[] = shuffled.map((q) => ({
    id: q.id,
    category: q.category,
    categoryLabel: q.categoryLabel,
    title: q.title,
    subtitle: q.subtitle,
    unit: q.unit,
    totalResponses: stats[q.id]?.totalResponses ?? 0,
  }));

  return c.json({
    questions,
    totalQuestions: questions.length,
    poolSize: QUIZ_MASTER.length,
    totalParticipants: sumParticipants(scoreCounts),
  });
});

/**
 * POST /api/quiz/submit
 * 回答を採点し、診断結果（上位%、回答分布棒グラフ）を返却。同時に D1 にログ保存 & 集計更新
 */
app.post('/api/quiz/submit', async (c) => {
  if (await isRateLimited(c.env.SUBMIT_RATE_LIMITER, c)) {
    return c.json({ error: 'Too many submissions. Please wait a moment.' }, 429);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const validated = validateAnswers(body);
  if ('error' in validated) {
    return c.json({ error: validated.error }, 400);
  }
  const { answers } = validated;

  try {
    const db = c.env.DB;
    const questionIds = answers.map((a) => a.questionId);
    let questionStats: Record<string, QuestionStats> = {};
    let scoreCounts: Record<number, number> = {};
    const historicalAnswers: Record<string, number[]> = {};

    // D1 から集計値・スコア分布・設問ごとの直近回答を1往復で取得する
    // 直近回答は設問ごとに ORDER BY id DESC LIMIT で取り、インデックス（question_id, rowid）を使って最大500件で読み止める
    if (db) {
      try {
        const placeholders = questionIds.map(() => '?').join(',');
        const [aggregates, scores, ...histories] = await db.batch([
          db.prepare(`SELECT ${AGGREGATE_COLUMNS} FROM item_aggregates WHERE question_id IN (${placeholders})`).bind(...questionIds),
          db.prepare('SELECT total_score, submissions FROM score_counts'),
          ...questionIds.map((id) =>
            db
              .prepare('SELECT user_answer FROM quiz_answers WHERE question_id = ? ORDER BY id DESC LIMIT ?')
              .bind(id, HISTORY_LIMIT_PER_QUESTION)
          ),
        ]);
        questionStats = toQuestionStats((aggregates.results ?? []) as unknown as AggregateRow[]);
        scoreCounts = toScoreCounts((scores.results ?? []) as unknown as { total_score: number; submissions: number }[]);
        questionIds.forEach((id, i) => {
          historicalAnswers[id] = ((histories[i]?.results ?? []) as unknown as { user_answer: number }[]).map((r) => r.user_answer);
        });
      } catch (readErr) {
        console.error('Failed to query D1 for scoring:', readErr);
      }
    }

    const result = calculateQuizResult(answers, { questionStats, historicalAnswers, scoreCounts });

    // D1 への保存（batch で1トランザクション）。未回答の設問は回答ログ・設問別集計に入れない
    if (db) {
      const statements: D1PreparedStatement[] = [
        db
          .prepare('INSERT INTO quiz_submissions (id, total_score, sense_type, bias_score) VALUES (?, ?, ?, ?)')
          .bind(result.submissionId, result.totalScore, result.senseType.code, result.biasScore),
        db
          .prepare(
            `INSERT INTO score_counts (total_score, submissions) VALUES (?, 1)
             ON CONFLICT(total_score) DO UPDATE SET submissions = submissions + 1`
          )
          .bind(result.totalScore),
      ];

      for (const item of result.questionResults) {
        if (item.userAnswer === null) continue;
        const inRange = isInRange(item.userAnswer, item.actualPrice);
        statements.push(
          db
            .prepare(
              'INSERT INTO quiz_answers (submission_id, question_id, user_answer, error_rate, score, in_range) VALUES (?, ?, ?, ?, ?, ?)'
            )
            .bind(result.submissionId, item.questionId, item.userAnswer, item.errorRate, item.score, inRange ? 1 : 0),
          // 集計対象外の回答は回答数だけ数え、合計・平均・最低値・最高値には入れない
          db
            .prepare(
              `INSERT INTO item_aggregates (question_id, total_responses, in_range_responses, sum_answers, average_answer, min_answer, max_answer)
               VALUES (?1, 1, ?2, ?3, ?3, ?4, ?4)
               ON CONFLICT(question_id) DO UPDATE SET
                 total_responses = total_responses + 1,
                 in_range_responses = in_range_responses + excluded.in_range_responses,
                 sum_answers = sum_answers + excluded.sum_answers,
                 average_answer = CASE
                   WHEN in_range_responses + excluded.in_range_responses > 0
                     THEN (sum_answers + excluded.sum_answers) / (in_range_responses + excluded.in_range_responses)
                   ELSE 0
                 END,
                 min_answer = MIN(COALESCE(min_answer, excluded.min_answer), COALESCE(excluded.min_answer, min_answer)),
                 max_answer = MAX(COALESCE(max_answer, excluded.max_answer), COALESCE(excluded.max_answer, max_answer)),
                 updated_at = CURRENT_TIMESTAMP`
            )
            .bind(item.questionId, inRange ? 1 : 0, inRange ? item.userAnswer : 0, inRange ? item.userAnswer : null)
        );
      }

      const execution = db.batch(statements).catch((dbErr) => {
        console.error('Failed to save submission to D1:', dbErr);
      });

      // Cloudflare Workers の executionCtx.waitUntil があれば利用、なければ await
      // （Hono の c.executionCtx は Workers 以外の環境ではアクセス時に例外を投げる）
      let executionCtx: { waitUntil(promise: Promise<unknown>): void } | undefined;
      try {
        executionCtx = c.executionCtx;
      } catch {
        executionCtx = undefined;
      }
      if (executionCtx) {
        executionCtx.waitUntil(execution);
      } else {
        await execution;
      }
    }

    return c.json(result);
  } catch (error) {
    console.error('Quiz submission error:', error);
    return c.json({ error: 'Failed to process quiz submission' }, 500);
  }
});

/**
 * GET /api/stats
 * 全ユーザーの統計（正解が逆算できないよう、正解価格・乖離率は返さない）
 * 平均は集計対象（正解の 1/5〜5倍）の回答だけで出す
 */
app.get('/api/stats', async (c) => {
  if (await isRateLimited(c.env.READ_RATE_LIMITER, c)) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  const { stats, scoreCounts } = await loadOverview(c.env.DB);

  const items: GlobalStatsItem[] = QUIZ_MASTER.map((q) => {
    const s = stats[q.id];
    return {
      questionId: q.id,
      title: q.title,
      averageExpected: s && s.inRangeResponses > 0 ? Math.round(s.sumAnswers / s.inRangeResponses) : null,
      totalResponses: s?.totalResponses ?? 0,
    };
  });

  return c.json({
    totalParticipants: sumParticipants(scoreCounts),
    items,
  });
});

export default app;
